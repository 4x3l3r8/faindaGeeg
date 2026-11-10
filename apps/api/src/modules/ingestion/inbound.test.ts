import { beforeEach, describe, expect, it, vi } from 'vitest';

const EXISTING_EXTERNAL_ID = 'dup';

const repoMock = vi.hoisted(() => ({
  getOrCreateSource: vi.fn(),
  createRun: vi.fn(),
  updateRun: vi.fn(),
  markSourceSynced: vi.fn(),
  findSourceRecordByExternalId: vi.fn(),
}));

const persistenceMock = vi.hoisted(() => ({
  insertSourceRecord: vi.fn(),
  findSourceRecordByHash: vi.fn(),
}));

const processingMock = vi.hoisted(() => ({
  processSourceRecord: vi.fn(),
}));

vi.mock('./repository.js', () => repoMock);
vi.mock('../opportunities/persistence.js', () => persistenceMock);
vi.mock('./processing.js', () => processingMock);

import {
  acceptInbound,
  inboundRecordSchema,
  normalizeInboundBody,
  type InboundRecord,
} from './inbound.js';

interface GetOrCreateSourceInput {
  name: string;
  sourceType: string;
}

interface InsertedRecordInput {
  externalId: string;
  title: string | null;
  contentText: string;
  publishedAt?: Date | null;
}

function record(input: { source: string; content: string; externalId?: string }): InboundRecord {
  return {
    source: input.source,
    sourceType: 'other',
    content: input.content,
    ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  repoMock.getOrCreateSource.mockImplementation(async (input: GetOrCreateSourceInput) => ({
    id: `src-${input.name}`,
  }));
  repoMock.createRun.mockResolvedValue({ id: 'run1' });
  repoMock.updateRun.mockResolvedValue({ id: 'run1' });
  repoMock.markSourceSynced.mockResolvedValue(undefined);
  repoMock.findSourceRecordByExternalId.mockImplementation(
    async (_sourceId: string, externalId: string) =>
      externalId === EXISTING_EXTERNAL_ID ? { id: 'rec-existing' } : undefined,
  );

  persistenceMock.findSourceRecordByHash.mockResolvedValue(undefined);
  persistenceMock.insertSourceRecord.mockImplementation(async (data: InsertedRecordInput) => ({
    id: 'rec1',
    title: data.title,
    contentText: data.contentText,
    publishedAt: data.publishedAt ?? null,
  }));

  processingMock.processSourceRecord.mockResolvedValue({
    status: 'created',
    opportunityId: 'op1',
    totalScore: 50,
  });
});

describe('inboundRecordSchema', () => {
  it('accepts a minimal record and defaults sourceType to "other"', () => {
    const parsed = inboundRecordSchema.parse({ source: 'Hacker News', content: 'hello world' });

    expect(parsed.source).toBe('Hacker News');
    expect(parsed.content).toBe('hello world');
    expect(parsed.sourceType).toBe('other');
  });

  it('rejects a record without content', () => {
    const result = inboundRecordSchema.safeParse({ source: 'Hacker News' });

    expect(result.success).toBe(false);
  });

  it('rejects a record with an empty source', () => {
    const result = inboundRecordSchema.safeParse({ source: '', content: 'hello world' });

    expect(result.success).toBe(false);
  });
});

describe('normalizeInboundBody', () => {
  it('wraps a single record in a one-element array', () => {
    const normalized = normalizeInboundBody({ source: 'Hacker News', content: 'single' });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.content).toBe('single');
  });

  it('unwraps the inner array of a { records } envelope', () => {
    const normalized = normalizeInboundBody({
      records: [
        { source: 'Hacker News', content: 'one' },
        { source: 'Hacker News', content: 'two' },
      ],
    });

    expect(normalized.map((item) => item.content)).toEqual(['one', 'two']);
  });

  it('returns a bare array unchanged', () => {
    const normalized = normalizeInboundBody([
      { source: 'Hacker News', content: 'alpha' },
      { source: 'Reddit', content: 'beta' },
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[1]?.source).toBe('Reddit');
  });
});

describe('acceptInbound', () => {
  it('upserts one source and creates one run for records sharing a source', async () => {
    const result = await acceptInbound([
      record({ source: 'Hacker News', content: 'first' }),
      record({ source: 'Hacker News', content: 'second' }),
    ]);

    expect(repoMock.getOrCreateSource).toHaveBeenCalledTimes(1);
    expect(repoMock.getOrCreateSource).toHaveBeenCalledWith({
      name: 'Hacker News',
      sourceType: 'other',
    });
    expect(repoMock.createRun).toHaveBeenCalledTimes(1);
    expect(repoMock.createRun).toHaveBeenCalledWith('src-Hacker News');

    expect(result.accepted).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(result.runIds).toEqual(['run1']);
    expect(persistenceMock.insertSourceRecord).toHaveBeenCalledTimes(2);
  });

  it('skips a record whose external id already exists and counts it as a duplicate', async () => {
    const result = await acceptInbound([
      record({ source: 'Hacker News', content: 'brand new', externalId: 'new-1' }),
      record({ source: 'Hacker News', content: 'seen before', externalId: EXISTING_EXTERNAL_ID }),
    ]);

    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.runIds).toEqual(['run1']);

    expect(persistenceMock.insertSourceRecord).toHaveBeenCalledTimes(1);
    expect(persistenceMock.insertSourceRecord).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'new-1', contentText: 'brand new' }),
    );
    expect(repoMock.findSourceRecordByExternalId).toHaveBeenCalledWith(
      'src-Hacker News',
      EXISTING_EXTERNAL_ID,
    );
  });

  it('groups records by source name, creating one run per distinct source', async () => {
    const result = await acceptInbound([
      record({ source: 'Hacker News', content: 'a' }),
      record({ source: 'Reddit', content: 'b' }),
      record({ source: 'Hacker News', content: 'c' }),
    ]);

    expect(repoMock.getOrCreateSource).toHaveBeenCalledTimes(2);
    expect(repoMock.createRun).toHaveBeenCalledTimes(2);
    expect(result.accepted).toBe(3);
    expect(result.runIds).toEqual(['run1', 'run1']);
  });
});
