import { createHash } from 'node:crypto';

import { insertSourceRecord } from '../opportunities/persistence.js';
import { sourceTypes, type SourceType } from '../../shared/index.js';
import { getConnector } from './connectors/index.js';
import type { IngestionCursor } from './connector.js';
import { processSourceRecord } from './processing.js';
import {
  createRun,
  findSourceRecordByExternalId,
  getOrCreateSource,
  listRuns,
  markSourceSynced,
  updateRun,
  type IngestionRun,
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

const DEFAULT_SOURCE_NAME = 'Hacker News';
const DEFAULT_MAX_RECORDS = 25;
const SOURCE_CREDIBILITY = 45;

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

export async function runIngestion(opts?: RunIngestionOptions): Promise<RunIngestionResult> {
  const sourceName = opts?.sourceName ?? DEFAULT_SOURCE_NAME;
  const maxRecords = opts?.maxRecords ?? DEFAULT_MAX_RECORDS;

  const connector = getConnector(sourceName);
  if (connector === null) {
    throw new Error(`Unknown ingestion source: ${sourceName}`);
  }

  const source = await getOrCreateSource({
    name: connector.sourceName,
    sourceType: toSourceType(connector.sourceType),
  });

  const run = await createRun(source.id);

  let cursor = await resolveStartingCursor(source.id, run.id);

  let recordsFetched = 0;
  let recordsNew = 0;
  let recordsProcessed = 0;
  let opportunitiesCreated = 0;
  const perRecordErrors: string[] = [];

  let status: IngestionRun['status'] = 'success';
  let failureMessage: string | null = null;

  try {
    while (recordsNew < maxRecords) {
      const batch = await connector.fetch(cursor);
      recordsFetched += batch.records.length;

      for (const raw of batch.records) {
        if (recordsNew >= maxRecords) {
          break;
        }

        const existing = await findSourceRecordByExternalId(source.id, raw.externalId);
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
          sourceId: source.id,
          externalId: raw.externalId,
          canonicalUrl: raw.url ?? null,
          title: raw.title ?? null,
          contentText: raw.content,
          contentHash,
          authorKey: raw.authorKey ?? null,
          publishedAt: raw.publishedAt ?? null,
          metadata,
        });
        recordsNew++;

        try {
          const processed = await processSourceRecord(
            {
              id: inserted.id,
              title: inserted.title,
              content: inserted.contentText,
              publishedAt: inserted.publishedAt,
            },
            { sourceCredibility: SOURCE_CREDIBILITY },
          );
          recordsProcessed++;
          if (processed.status === 'created') {
            opportunitiesCreated++;
          }
        } catch (error) {
          perRecordErrors.push(toErrorMessage(error));
        }
      }

      cursor = batch.nextCursor;
      if (!batch.hasMore || cursor === undefined) {
        break;
      }
    }
  } catch (error) {
    failureMessage = toErrorMessage(error);
    status = recordsProcessed === 0 ? 'failed' : 'partial';
    perRecordErrors.push(failureMessage);
  }

  if (failureMessage === null) {
    status = perRecordErrors.length > 0 ? 'partial' : 'success';
  }

  const error =
    status === 'failed'
      ? failureMessage
      : perRecordErrors.slice(0, 5).join(' | ') || null;

  await updateRun(run.id, {
    status,
    finishedAt: new Date(),
    recordsFetched,
    recordsNew,
    recordsProcessed,
    opportunitiesCreated,
    error,
    cursor: cursor ?? null,
  });

  if (status === 'success' || status === 'partial') {
    await markSourceSynced(source.id, new Date());
  }

  return {
    runId: run.id,
    status,
    recordsFetched,
    recordsNew,
    recordsProcessed,
    opportunitiesCreated,
    error,
  };
}
