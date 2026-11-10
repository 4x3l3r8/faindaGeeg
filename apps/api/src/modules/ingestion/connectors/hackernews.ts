import type {
  IngestionBatch,
  IngestionCursor,
  ISourceConnector,
  RawSourceRecord,
} from '../connector.js';

const HN_SEARCH_ENDPOINT = 'https://hn.algolia.com/api/v1/search_by_date';
const HN_ITEM_URL = 'https://news.ycombinator.com/item?id=';

const DEFAULT_QUERIES = [
  'freelance developer',
  'looking for a developer',
  'need a developer',
  'hiring developer',
];

const DEFAULT_HITS_PER_PAGE = 20;

export interface HackerNewsConnectorOptions {
  queries?: string[];
  hitsPerPage?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRequestUrl(query: string, page: number, hitsPerPage: number): string {
  const params = new URLSearchParams({
    tags: 'comment',
    query,
    hitsPerPage: String(hitsPerPage),
    page: String(page),
  });

  return `${HN_SEARCH_ENDPOINT}?${params.toString()}`;
}

function mapHit(hit: Record<string, unknown>, query: string): RawSourceRecord | null {
  const rawId = hit['objectID'];
  if (typeof rawId !== 'string' && typeof rawId !== 'number') {
    return null;
  }

  const externalId = String(rawId);

  const commentText = asString(hit['comment_text']);
  if (commentText === undefined) {
    return null;
  }

  const content = htmlToText(commentText);
  if (content.length === 0) {
    return null;
  }

  const record: RawSourceRecord = {
    externalId,
    url: `${HN_ITEM_URL}${externalId}`,
    content,
    metadata: {
      points: hit['points'] ?? null,
      storyId: hit['story_id'] ?? null,
      query,
    },
  };

  const storyTitle = asString(hit['story_title']);
  if (storyTitle !== undefined) {
    record.title = storyTitle;
  }

  const author = asString(hit['author']);
  if (author !== undefined) {
    record.authorKey = author;
  }

  const createdAt = asString(hit['created_at']);
  if (createdAt !== undefined) {
    const publishedAt = new Date(createdAt);
    if (!Number.isNaN(publishedAt.getTime())) {
      record.publishedAt = publishedAt;
    }
  }

  return record;
}

export class HackerNewsConnector implements ISourceConnector {
  readonly sourceName = 'Hacker News';
  readonly sourceType = 'other';

  private readonly queries: string[];
  private readonly hitsPerPage: number;

  constructor(options: HackerNewsConnectorOptions = {}) {
    this.queries = options.queries ?? [...DEFAULT_QUERIES];
    this.hitsPerPage = options.hitsPerPage ?? DEFAULT_HITS_PER_PAGE;
  }

  async fetch(cursor?: IngestionCursor, signal?: AbortSignal): Promise<IngestionBatch> {
    const query = cursor?.query ?? this.queries[0] ?? '';
    const rawPage = cursor?.page ?? 0;
    const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;

    const response = await fetch(buildRequestUrl(query, page, this.hitsPerPage), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: signal ?? null,
    });

    if (!response.ok) {
      throw new Error(
        `Hacker News search request failed with status ${response.status} ${response.statusText}`,
      );
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error('Hacker News search response was not a JSON object');
    }

    const rawHits = payload['hits'];
    const hits = Array.isArray(rawHits) ? rawHits : [];

    const records: RawSourceRecord[] = [];
    for (const hit of hits) {
      if (!isRecord(hit)) {
        continue;
      }
      const record = mapHit(hit, query);
      if (record !== null) {
        records.push(record);
      }
    }

    const nbPages = typeof payload['nbPages'] === 'number' ? payload['nbPages'] : 0;

    let nextCursor: IngestionCursor | undefined;
    let hasMore = false;

    if (page + 1 < nbPages) {
      nextCursor = { query, page: page + 1 };
      hasMore = true;
    } else {
      const currentIndex = this.queries.indexOf(query);
      const nextQuery = currentIndex >= 0 ? this.queries[currentIndex + 1] : undefined;
      if (nextQuery !== undefined) {
        nextCursor = { query: nextQuery, page: 0 };
        hasMore = true;
      }
    }

    const batch: IngestionBatch = { records, hasMore };
    if (nextCursor !== undefined) {
      batch.nextCursor = nextCursor;
    }

    return batch;
  }
}
