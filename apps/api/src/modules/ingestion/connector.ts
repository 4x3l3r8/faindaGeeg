export interface IngestionCursor {
  query?: string;
  page?: number;
  [k: string]: unknown;
}

export interface RawSourceRecord {
  externalId: string;
  url?: string;
  title?: string;
  content: string;
  authorKey?: string;
  publishedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface IngestionBatch {
  records: RawSourceRecord[];
  nextCursor?: IngestionCursor;
  hasMore: boolean;
}

export interface ISourceConnector {
  sourceName: string;
  sourceType: string;
  fetch(cursor?: IngestionCursor, signal?: AbortSignal): Promise<IngestionBatch>;
}
