import { z } from 'zod';

import { hashContent } from '../../shared/hash.js';
import { sourceTypeSchema } from '../../shared/enums.js';
import { mapWithConcurrency } from '../../shared/concurrency.js';
import { findSourceRecordByHash, insertSourceRecord } from '../opportunities/persistence.js';
import { processSourceRecord } from './processing.js';
import {
  createRun,
  findSourceRecordByExternalId,
  getOrCreateSource,
  markSourceSynced,
  updateRun,
  type IngestionRun,
} from './repository.js';

export const inboundRecordSchema = z.object({
  source: z.string().min(1).max(120),
  sourceType: sourceTypeSchema.optional().default('other'),
  externalId: z.string().min(1).optional(),
  url: z.string().url().optional(),
  title: z.string().optional(),
  content: z.string().min(1),
  author: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
});

export type InboundRecord = z.infer<typeof inboundRecordSchema>;

export const inboundBodySchema = z.union([
  inboundRecordSchema,
  z.object({ records: z.array(inboundRecordSchema).min(1).max(50) }),
  z.array(inboundRecordSchema).min(1).max(50),
]);

export function normalizeInboundBody(body: unknown): InboundRecord[] {
  const parsed = inboundBodySchema.parse(body);

  if (Array.isArray(parsed)) {
    return parsed;
  }
  if ('records' in parsed) {
    return parsed.records;
  }
  return [parsed];
}

export interface AcceptInboundResult {
  accepted: number;
  duplicates: number;
  runIds: string[];
}

interface InsertedRow {
  id: string;
  title: string | null;
  contentText: string;
  publishedAt: Date | null;
}

const SOURCE_CREDIBILITY = 45;
const CONCURRENCY_LIMIT = 4;
const PROGRESS_WRITE_INTERVAL_MS = 1500;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function processGroup(
  runId: string,
  sourceId: string,
  rows: readonly InsertedRow[],
): Promise<void> {
  const progress = { recordsProcessed: 0, opportunitiesCreated: 0 };
  const perRecordErrors: string[] = [];

  let lastProgressWrite = Date.now();

  const writeProgressThrottled = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastProgressWrite < PROGRESS_WRITE_INTERVAL_MS) {
      return;
    }
    lastProgressWrite = now;
    await updateRun(runId, {
      recordsProcessed: progress.recordsProcessed,
      opportunitiesCreated: progress.opportunitiesCreated,
    });
  };

  await mapWithConcurrency(rows, CONCURRENCY_LIMIT, async (row) => {
    try {
      const processed = await processSourceRecord(
        {
          id: row.id,
          title: row.title,
          content: row.contentText,
          publishedAt: row.publishedAt,
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

  const status: IngestionRun['status'] = perRecordErrors.length > 0 ? 'partial' : 'success';

  await updateRun(runId, {
    status,
    finishedAt: new Date(),
    recordsNew: rows.length,
    recordsProcessed: progress.recordsProcessed,
    opportunitiesCreated: progress.opportunitiesCreated,
    error: perRecordErrors.slice(0, 5).join(' | ') || null,
  });

  await markSourceSynced(sourceId, new Date());
}

export async function acceptInbound(records: InboundRecord[]): Promise<AcceptInboundResult> {
  const groups = new Map<string, InboundRecord[]>();

  for (const record of records) {
    const existing = groups.get(record.source);
    if (existing === undefined) {
      groups.set(record.source, [record]);
    } else {
      existing.push(record);
    }
  }

  let accepted = 0;
  let duplicates = 0;
  const runIds: string[] = [];

  for (const [name, group] of groups) {
    const first = group[0];
    if (first === undefined) {
      continue;
    }

    const source = await getOrCreateSource({ name, sourceType: first.sourceType });
    const run = await createRun(source.id);
    runIds.push(run.id);

    const insertedRows: InsertedRow[] = [];

    for (const record of group) {
      const contentHash = hashContent(record.content);
      const existing =
        record.externalId !== undefined
          ? await findSourceRecordByExternalId(source.id, record.externalId)
          : await findSourceRecordByHash(source.id, contentHash);

      if (existing !== undefined) {
        duplicates++;
        continue;
      }

      const inserted = await insertSourceRecord({
        sourceId: source.id,
        externalId: record.externalId ?? contentHash,
        canonicalUrl: record.url ?? null,
        title: record.title ?? null,
        contentText: record.content,
        contentHash,
        authorKey: record.author ?? null,
        publishedAt: record.publishedAt ?? null,
        metadata: { via: 'webhook' },
      });
      accepted++;
      insertedRows.push({
        id: inserted.id,
        title: inserted.title,
        contentText: inserted.contentText,
        publishedAt: inserted.publishedAt,
      });
    }

    void processGroup(run.id, source.id, insertedRows).catch(async (error) => {
      await updateRun(run.id, {
        status: 'failed',
        finishedAt: new Date(),
        error: toErrorMessage(error),
      });
    });
  }

  return { accepted, duplicates, runIds };
}
