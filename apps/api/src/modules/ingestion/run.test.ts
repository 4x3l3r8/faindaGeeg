import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestionBatch, ISourceConnector } from './connector.js';

const EXISTING_EXTERNAL_ID = 'existing-1';

const repoMock = vi.hoisted(() => ({
  createRun: vi.fn(),
  listRuns: vi.fn(),
  getOrCreateSource: vi.fn(),
  updateRun: vi.fn(),
  markSourceSynced: vi.fn(),
  findSourceRecordByExternalId: vi.fn(),
}));

const persistenceMock = vi.hoisted(() => ({
  insertSourceRecord: vi.fn(),
}));

const processingMock = vi.hoisted(() => ({
  processSourceRecord: vi.fn(),
}));

const connectorsMock = vi.hoisted(() => ({
  getConnector: vi.fn(),
}));

vi.mock('./repository.js', () => repoMock);
vi.mock('../opportunities/persistence.js', () => persistenceMock);
vi.mock('./processing.js', () => processingMock);
vi.mock('./connectors/index.js', () => connectorsMock);

import { runIngestion } from './run.js';

interface InsertedRecordInput {
  externalId: string;
  title: string | null;
  contentText: string;
}

interface ProcessTarget {
  id: string;
  title: string | null;
  content: string;
}

function makeConnector(batch: IngestionBatch): ISourceConnector {
  return {
    sourceName: 'Hacker News',
    sourceType: 'other',
    fetch: vi.fn(async () => batch),
  };
}

const THREE_RECORD_BATCH: IngestionBatch = {
  records: [
    { externalId: EXISTING_EXTERNAL_ID, content: 'already stored comment' },
    { externalId: 'new-1', content: 'first new comment' },
    { externalId: 'new-2', content: 'second new comment' },
  ],
  hasMore: false,
};

beforeEach(() => {
  vi.clearAllMocks();

  repoMock.createRun.mockResolvedValue({ id: 'run1' });
  repoMock.listRuns.mockResolvedValue([]);
  repoMock.getOrCreateSource.mockResolvedValue({ id: 'src1' });
  repoMock.updateRun.mockResolvedValue({ id: 'run1' });
  repoMock.markSourceSynced.mockResolvedValue(undefined);
  repoMock.findSourceRecordByExternalId.mockImplementation(
    async (_sourceId: string, externalId: string) =>
      externalId === EXISTING_EXTERNAL_ID ? { id: 'rec-existing' } : undefined,
  );

  persistenceMock.insertSourceRecord.mockImplementation(async (data: InsertedRecordInput) => ({
    id: `rec-${data.externalId}`,
    title: data.title,
    contentText: data.contentText,
  }));

  processingMock.processSourceRecord.mockResolvedValue({
    status: 'created',
    opportunityId: 'op1',
    totalScore: 50,
  });

  connectorsMock.getConnector.mockReturnValue(makeConnector(THREE_RECORD_BATCH));
});

describe('runIngestion', () => {
  it('skips pre-existing records by external id and reports success counts', async () => {
    const result = await runIngestion();

    expect(result.runId).toBe('run1');
    expect(result.recordsFetched).toBe(3);
    expect(result.recordsNew).toBe(2);
    expect(result.recordsProcessed).toBe(2);
    expect(result.opportunitiesCreated).toBe(2);
    expect(result.status).toBe('success');
    expect(result.error).toBeNull();

    expect(processingMock.processSourceRecord).toHaveBeenCalledTimes(2);
    const processedIds = processingMock.processSourceRecord.mock.calls.map(
      (call) => (call[0] as ProcessTarget).id,
    );
    expect(processedIds).toEqual(['rec-new-1', 'rec-new-2']);

    expect(repoMock.updateRun).toHaveBeenCalledTimes(1);
    expect(repoMock.updateRun).toHaveBeenCalledWith(
      'run1',
      expect.objectContaining({
        status: 'success',
        recordsFetched: 3,
        recordsNew: 2,
        recordsProcessed: 2,
        opportunitiesCreated: 2,
      }),
    );
    expect(repoMock.markSourceSynced).toHaveBeenCalledTimes(1);
    expect(repoMock.markSourceSynced).toHaveBeenCalledWith('src1', expect.any(Date));
  });

  it('isolates a per-record failure and finishes with partial status', async () => {
    processingMock.processSourceRecord.mockImplementation(async (record: ProcessTarget) => {
      if (record.id === 'rec-new-2') {
        throw new Error('extraction exploded');
      }
      return { status: 'created', opportunityId: 'op1', totalScore: 50 };
    });

    const result = await runIngestion();

    expect(result.recordsFetched).toBe(3);
    expect(result.recordsNew).toBe(2);
    expect(result.recordsProcessed).toBe(1);
    expect(result.opportunitiesCreated).toBe(1);
    expect(result.status).toBe('partial');
    expect(result.error).toContain('extraction exploded');

    expect(repoMock.updateRun).toHaveBeenCalledWith(
      'run1',
      expect.objectContaining({
        status: 'partial',
        recordsProcessed: 1,
      }),
    );
    expect(repoMock.markSourceSynced).toHaveBeenCalledTimes(1);
  });

  it('respects maxRecords when it is smaller than the number of new records', async () => {
    const result = await runIngestion({ maxRecords: 1 });

    expect(result.recordsNew).toBe(1);
    expect(result.recordsProcessed).toBe(1);
    expect(result.opportunitiesCreated).toBe(1);
    expect(result.status).toBe('success');
    expect(processingMock.processSourceRecord).toHaveBeenCalledTimes(1);
  });
});
