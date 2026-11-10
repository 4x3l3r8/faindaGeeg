import { createHash } from 'node:crypto';

import { insertSourceRecord } from '../opportunities/persistence.js';
import { sourceTypes, type SourceType } from '../../shared/index.js';
import { mapWithConcurrency } from '../../shared/concurrency.js';
import { getConnector } from './connectors/index.js';
import type { IngestionCursor, ISourceConnector } from './connector.js';
import { processSourceRecord } from './processing.js';
import {
  createRun,
  findSourceRecordByExternalId,
  getOrCreateSource,
  listRuns,
  markSourceSynced,
  updateRun,
  type IngestionRun,
  type SourceRecord,
} from './repository.js';

export interface RunIngestionOptions {
  sourceName?: string;
  maxRecords?: number;
}

export interface RunIngestionResult {
  runId: string;
  status: string;
  recordsFetched: number;
  recordsNew: number;
  recordsProcessed: number;
  opportunitiesCreated: number;
  error: string | null;
}

export interface StartIngestionResult {
  runId: string;
  status: 'running';
}

interface ExecuteIngestionOptions {
  maxRecords: number;
}

interface IngestionProgress {
  recordsFetched: number;
  recordsNew: number;
  recordsProcessed: number;
  opportunitiesCreated: number;
}

const DEFAULT_SOURCE_NAME = 'Hacker News';
const DEFAULT_MAX_RECORDS = 25;
const SOURCE_CREDIBILITY = 45;
const CONCURRENCY_LIMIT = 4;
const PROGRESS_WRITE_INTERVAL_MS = 1500;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hashContent(content: string): string {
  return createHash('sha256').update(normalizeWhitespace(content)).digest('hex');
}

function toSourceType(value: string): SourceType {
  return sourceTypes.find((candidate) => candidate === value) ?? 'other';
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asCursor(value: unknown): IngestionCursor | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as IngestionCursor;
  }
  return undefined;
}

async function resolveStartingCursor(
  sourceId: string,
  currentRunId: string,
): Promise<IngestionCursor | undefined> {
  const recentRuns = await listRuns({ sourceId, limit: 2 });

  for (const candidate of recentRuns) {
    if (candidate.id === currentRunId) {
      continue;
    }
    const cursor = asCursor(candidate.cursor);
    if (cursor !== undefined) {
      return cursor;
    }
  }

  return undefined;
}

async function resolveConnectorAndSource(
  sourceName: string,
): Promise<{ connector: ISourceConnector; sourceId: string }> {
  const connector = getConnector(sourceName);
  if (connector === null) {
    throw new Error(`Unknown ingestion source: ${sourceName}`);
  }

  const source = await getOrCreateSource({
    name: connector.sourceName,
    sourceType: toSourceType(connector.sourceType),
  });

  return { connector, sourceId: source.id };
}

async function executeIngestion(
  runId: string,
  sourceId: string,
  connector: ISourceConnector,
  opts: ExecuteIngestionOptions,
): Promise<RunIngestionResult> {
  const maxRecords = opts.maxRecords;

  let cursor = await resolveStartingCursor(sourceId, runId);

  const progress: IngestionProgress = {
    recordsFetched: 0,
    recordsNew: 0,
    recordsProcessed: 0,
    opportunitiesCreated: 0,
  };
  const perRecordErrors: string[] = [];

  let lastProgressWrite = Date.now();

  const writeProgressThrottled = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastProgressWrite < PROGRESS_WRITE_INTERVAL_MS) {
      return;
    }
    lastProgressWrite = now;
    await updateRun(runId, {
      recordsFetched: progress.recordsFetched,
      recordsNew: progress.recordsNew,
      recordsProcessed: progress.recordsProcessed,
      opportunitiesCreated: progress.opportunitiesCreated,
    });
  };

  let status: IngestionRun['status'] = 'success';
  let failureMessage: string | null = null;

  try {
    while (progress.recordsNew < maxRecords) {
      const batch = await connector.fetch(cursor);
      progress.recordsFetched += batch.records.length;

      const newRecords: SourceRecord[] = [];

      for (const raw of batch.records) {
        if (progress.recordsNew >= maxRecords) {
          break;
        }

        const existing = await findSourceRecordByExternalId(sourceId, raw.externalId);
        if (existing !== undefined) {
          continue;
        }

        const contentHash = hashContent(raw.content);
        const metadata: Record<string, unknown> = { ...(raw.metadata ?? {}) };
        if (raw.authorKey !== undefined) {
          metadata['authorKey'] = raw.authorKey;
        }
        if (raw.publishedAt !== undefined) {
          metadata['publishedAt'] = raw.publishedAt.toISOString();
        }

        const inserted = await insertSourceRecord({
          sourceId,
          externalId: raw.externalId,
          canonicalUrl: raw.url ?? null,
          title: raw.title ?? null,
          contentText: raw.content,
          contentHash,
          authorKey: raw.authorKey ?? null,
          publishedAt: raw.publishedAt ?? null,
          metadata,
        });
        progress.recordsNew++;
        newRecords.push(inserted);
      }

      await writeProgressThrottled();

      await mapWithConcurrency(newRecords, CONCURRENCY_LIMIT, async (record) => {
        try {
          const processed = await processSourceRecord(
            {
              id: record.id,
              title: record.title,
              content: record.contentText,
              publishedAt: record.publishedAt,
            },
            { sourceCredibility: SOURCE_CREDIBILITY },
          );
          progress.recordsProcessed++;
          if (processed.status === 'created') {
            progress.opportunitiesCreated++;
          }
        } catch (error) {
          perRecordErrors.push(toErrorMessage(error));
        }
        await writeProgressThrottled();
      });

      cursor = batch.nextCursor;
      if (!batch.hasMore || cursor === undefined) {
        break;
      }

      await writeProgressThrottled();
    }
  } catch (error) {
    failureMessage = toErrorMessage(error);
    status = progress.recordsProcessed === 0 ? 'failed' : 'partial';
    perRecordErrors.push(failureMessage);
  }

  if (failureMessage === null) {
    status = perRecordErrors.length > 0 ? 'partial' : 'success';
  }

  const error =
    status === 'failed' ? failureMessage : perRecordErrors.slice(0, 5).join(' | ') || null;

  await updateRun(runId, {
    status,
    finishedAt: new Date(),
    recordsFetched: progress.recordsFetched,
    recordsNew: progress.recordsNew,
    recordsProcessed: progress.recordsProcessed,
    opportunitiesCreated: progress.opportunitiesCreated,
    error,
    cursor: cursor ?? null,
  });

  if (status === 'success' || status === 'partial') {
    await markSourceSynced(sourceId, new Date());
  }

  return {
    runId,
    status,
    recordsFetched: progress.recordsFetched,
    recordsNew: progress.recordsNew,
    recordsProcessed: progress.recordsProcessed,
    opportunitiesCreated: progress.opportunitiesCreated,
    error,
  };
}

export async function runIngestion(opts?: RunIngestionOptions): Promise<RunIngestionResult> {
  const sourceName = opts?.sourceName ?? DEFAULT_SOURCE_NAME;
  const maxRecords = opts?.maxRecords ?? DEFAULT_MAX_RECORDS;

  const { connector, sourceId } = await resolveConnectorAndSource(sourceName);

  const run = await createRun(sourceId);

  return executeIngestion(run.id, sourceId, connector, { maxRecords });
}

export async function startIngestion(opts?: RunIngestionOptions): Promise<StartIngestionResult> {
  const sourceName = opts?.sourceName ?? DEFAULT_SOURCE_NAME;
  const maxRecords = opts?.maxRecords ?? DEFAULT_MAX_RECORDS;

  const { connector, sourceId } = await resolveConnectorAndSource(sourceName);

  const run = await createRun(sourceId);

  void executeIngestion(run.id, sourceId, connector, { maxRecords }).catch(async (error) => {
    await updateRun(run.id, {
      status: 'failed',
      finishedAt: new Date(),
      error: toErrorMessage(error),
    });
  });

  return { runId: run.id, status: 'running' };
}
