import { and, desc, eq } from 'drizzle-orm';
import { getDb, ingestionRuns, sourceRecords, sources } from '@toi/db';

import type { SourceType } from '../../shared/index.js';

export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type SourceRecord = typeof sourceRecords.$inferSelect;

export interface UpdateRunPatch {
  status?: IngestionRun['status'];
  finishedAt?: Date | null;
  recordsFetched?: number;
  recordsNew?: number;
  recordsProcessed?: number;
  opportunitiesCreated?: number;
  error?: string | null;
  cursor?: unknown;
}

export interface ListRunsParams {
  sourceId?: string;
  limit?: number;
}

export interface GetOrCreateSourceInput {
  name: string;
  sourceType: SourceType;
  configuration?: Record<string, unknown>;
}

export async function createRun(sourceId: string | null): Promise<IngestionRun> {
  const db = getDb();

  const inserted = await db
    .insert(ingestionRuns)
    .values({ sourceId, status: 'running', startedAt: new Date() })
    .returning();

  const row = inserted[0];
  if (row === undefined) {
    throw new Error('Failed to create the ingestion run');
  }

  return row;
}

export async function updateRun(id: string, patch: UpdateRunPatch): Promise<IngestionRun> {
  const db = getDb();

  const values: Partial<typeof ingestionRuns.$inferInsert> = {};

  if (patch.status !== undefined) {
    values.status = patch.status;
  }
  if (patch.finishedAt !== undefined) {
    values.finishedAt = patch.finishedAt;
  }
  if (patch.recordsFetched !== undefined) {
    values.recordsFetched = patch.recordsFetched;
  }
  if (patch.recordsNew !== undefined) {
    values.recordsNew = patch.recordsNew;
  }
  if (patch.recordsProcessed !== undefined) {
    values.recordsProcessed = patch.recordsProcessed;
  }
  if (patch.opportunitiesCreated !== undefined) {
    values.opportunitiesCreated = patch.opportunitiesCreated;
  }
  if (patch.error !== undefined) {
    values.error = patch.error;
  }
  if (patch.cursor !== undefined) {
    values.cursor = patch.cursor;
  }

  const updated = await db
    .update(ingestionRuns)
    .set(values)
    .where(eq(ingestionRuns.id, id))
    .returning();

  const row = updated[0];
  if (row === undefined) {
    throw new Error('Failed to update the ingestion run');
  }

  return row;
}

export async function listRuns(params?: ListRunsParams): Promise<IngestionRun[]> {
  const db = getDb();

  const limit = params?.limit ?? 50;
  const where =
    params?.sourceId === undefined ? undefined : eq(ingestionRuns.sourceId, params.sourceId);

  return db
    .select()
    .from(ingestionRuns)
    .where(where)
    .orderBy(desc(ingestionRuns.createdAt))
    .limit(limit);
}

export async function getRun(id: string): Promise<IngestionRun | null> {
  const db = getDb();

  const rows = await db.select().from(ingestionRuns).where(eq(ingestionRuns.id, id)).limit(1);

  return rows[0] ?? null;
}

export async function findSourceRecordByExternalId(
  sourceId: string,
  externalId: string,
): Promise<SourceRecord | undefined> {
  const db = getDb();

  const rows = await db
    .select()
    .from(sourceRecords)
    .where(and(eq(sourceRecords.sourceId, sourceId), eq(sourceRecords.externalId, externalId)))
    .limit(1);

  return rows[0];
}

export async function getOrCreateSource(input: GetOrCreateSourceInput): Promise<Source> {
  const db = getDb();

  const existing = await db.select().from(sources).where(eq(sources.name, input.name)).limit(1);

  const found = existing[0];
  if (found !== undefined) {
    return found;
  }

  const inserted = await db
    .insert(sources)
    .values({
      name: input.name,
      sourceType: input.sourceType,
      isEnabled: true,
      ...(input.configuration === undefined ? {} : { configuration: input.configuration }),
    })
    .returning();

  const created = inserted[0];
  if (created === undefined) {
    throw new Error('Failed to create the source');
  }

  return created;
}

export async function listSources(): Promise<Source[]> {
  const db = getDb();

  return db.select().from(sources).orderBy(sources.name);
}

export async function markSourceSynced(sourceId: string, at: Date): Promise<void> {
  const db = getDb();

  await db
    .update(sources)
    .set({ lastSuccessfulSyncAt: at })
    .where(eq(sources.id, sourceId));
}
