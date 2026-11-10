import { env } from '../../../config/env.js';
import { stripHtml } from '../../../shared/text.js';
import type {
  IngestionBatch,
  IngestionCursor,
  ISourceConnector,
  RawSourceRecord,
} from '../connector.js';

const STACKEXCHANGE_ENDPOINT = 'https://api.stackexchange.com/2.3/questions';

const DEFAULT_SITE = 'stackoverflow';
const DEFAULT_TAGS = ['typescript', 'node.js', 'react', 'api'];
const DEFAULT_PAGE_SIZE = 30;

export interface StackExchangeConnectorOptions {
  site?: string;
  tags?: string[];
  pageSize?: number;
  apiKey?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : undefined;
}

function buildRequestUrl(
  site: string,
  tags: string[],
  pageSize: number,
  page: number,
  apiKey: string | undefined,
): string {
  const params = new URLSearchParams({
    order: 'desc',
    sort: 'creation',
    site,
    tagged: tags.join(';'),
    pagesize: String(pageSize),
    page: String(page),
    filter: 'withbody',
  });

  if (apiKey !== undefined) {
    params.set('key', apiKey);
  }

  return `${STACKEXCHANGE_ENDPOINT}?${params.toString()}`;
}

function mapItem(item: Record<string, unknown>): RawSourceRecord | null {
  const rawId = item['question_id'];
  if (typeof rawId !== 'string' && typeof rawId !== 'number') {
    return null;
  }

  const title = asString(item['title']) ?? '';
  const body = asString(item['body']) ?? '';
  const content = `${title}\n\n${stripHtml(body)}`;

  const rawTags = item['tags'];
  const tags = Array.isArray(rawTags) ? rawTags.filter((t) => typeof t === 'string') : null;

  const record: RawSourceRecord = {
    externalId: String(rawId),
    content,
    metadata: {
      score: asNumber(item['score']) ?? null,
      tags,
    },
  };

  const url = asString(item['link']);
  if (url !== undefined) {
    record.url = url;
  }

  if (title.length > 0) {
    record.title = title;
  }

  const owner = item['owner'];
  if (isRecord(owner)) {
    const displayName = asString(owner['display_name']);
    if (displayName !== undefined) {
      record.authorKey = displayName;
    }
  }

  const creationDate = asNumber(item['creation_date']);
  if (creationDate !== undefined) {
    record.publishedAt = new Date(creationDate * 1000);
  }

  return record;
}

export class StackExchangeConnector implements ISourceConnector {
  readonly sourceName = 'Stack Exchange';
  readonly sourceType = 'other';

  private readonly site: string;
  private readonly tags: string[];
  private readonly pageSize: number;
  private readonly apiKey: string | undefined;

  constructor(options: StackExchangeConnectorOptions = {}) {
    this.site = options.site ?? env.STACKEXCHANGE_SITE ?? DEFAULT_SITE;
    this.tags = options.tags ?? parseTags(env.STACKEXCHANGE_TAGS) ?? [...DEFAULT_TAGS];
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    this.apiKey = options.apiKey ?? env.STACKEXCHANGE_KEY;
  }

  async fetch(cursor?: IngestionCursor, signal?: AbortSignal): Promise<IngestionBatch> {
    const rawPage = cursor?.page;
    const page =
      typeof rawPage === 'number' && Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

    const response = await fetch(
      buildRequestUrl(this.site, this.tags, this.pageSize, page, this.apiKey),
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: signal ?? null,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Stack Exchange request failed with status ${response.status} ${response.statusText}`,
      );
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error('Stack Exchange response was not a JSON object');
    }

    const rawItems = payload['items'];
    const items = Array.isArray(rawItems) ? rawItems : [];

    const records: RawSourceRecord[] = [];
    for (const item of items) {
      if (!isRecord(item)) {
        continue;
      }
      const record = mapItem(item);
      if (record !== null) {
        records.push(record);
      }
    }

    const hasMore = payload['has_more'] === true;

    if (hasMore) {
      return { records, nextCursor: { page: page + 1 }, hasMore: true };
    }

    return { records, hasMore: false };
  }
}
