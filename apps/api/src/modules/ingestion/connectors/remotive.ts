import { env } from '../../../config/env.js';
import { stripHtml } from '../../../shared/text.js';
import type {
  IngestionBatch,
  IngestionCursor,
  ISourceConnector,
  RawSourceRecord,
} from '../connector.js';

const REMOTIVE_ENDPOINT = 'https://remotive.com/api/remote-jobs';

const DEFAULT_CATEGORY = 'software-dev';
const DEFAULT_LIMIT = 50;

export interface RemotiveConnectorOptions {
  category?: string;
  search?: string;
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function buildRequestUrl(category: string, limit: number, search: string | undefined): string {
  const params = new URLSearchParams({
    category,
    limit: String(limit),
  });

  if (search !== undefined) {
    params.set('search', search);
  }

  return `${REMOTIVE_ENDPOINT}?${params.toString()}`;
}

function mapJob(job: Record<string, unknown>): RawSourceRecord | null {
  const rawId = job['id'];
  if (typeof rawId !== 'string' && typeof rawId !== 'number') {
    return null;
  }

  const title = asString(job['title']) ?? '';
  const companyName = asString(job['company_name']) ?? '';
  const description = asString(job['description']) ?? '';
  const content = `${title}\n${companyName}\n${stripHtml(description)}`;

  const rawTags = job['tags'];
  const tags = Array.isArray(rawTags) ? rawTags.filter((t) => typeof t === 'string') : null;

  const record: RawSourceRecord = {
    externalId: String(rawId),
    content,
    metadata: {
      jobType: asString(job['job_type']) ?? null,
      location: asString(job['candidate_required_location']) ?? null,
      salary: asString(job['salary']) ?? null,
      tags,
      category: asString(job['category']) ?? null,
    },
  };

  const url = asString(job['url']);
  if (url !== undefined) {
    record.url = url;
  }

  if (title.length > 0) {
    record.title = title;
  }

  if (companyName.length > 0) {
    record.authorKey = companyName;
  }

  const publicationDate = asString(job['publication_date']);
  if (publicationDate !== undefined) {
    const publishedAt = new Date(publicationDate);
    if (!Number.isNaN(publishedAt.getTime())) {
      record.publishedAt = publishedAt;
    }
  }

  return record;
}

export class RemotiveConnector implements ISourceConnector {
  readonly sourceName = 'Remotive';
  readonly sourceType = 'job_board';

  private readonly category: string;
  private readonly search: string | undefined;
  private readonly limit: number;

  constructor(options: RemotiveConnectorOptions = {}) {
    this.category = options.category ?? env.REMOTIVE_CATEGORY ?? DEFAULT_CATEGORY;
    this.search = options.search ?? env.REMOTIVE_SEARCH;
    this.limit = options.limit ?? DEFAULT_LIMIT;
  }

  async fetch(_cursor?: IngestionCursor, signal?: AbortSignal): Promise<IngestionBatch> {
    const response = await fetch(buildRequestUrl(this.category, this.limit, this.search), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: signal ?? null,
    });

    if (!response.ok) {
      throw new Error(
        `Remotive request failed with status ${response.status} ${response.statusText}`,
      );
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error('Remotive response was not a JSON object');
    }

    const rawJobs = payload['jobs'];
    const jobs = Array.isArray(rawJobs) ? rawJobs : [];

    const records: RawSourceRecord[] = [];
    for (const job of jobs) {
      if (!isRecord(job)) {
        continue;
      }
      const record = mapJob(job);
      if (record !== null) {
        records.push(record);
      }
    }

    return { records, hasMore: false };
  }
}
