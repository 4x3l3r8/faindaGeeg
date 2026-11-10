import { env } from '../../../config/env.js';
import type {
  IngestionBatch,
  IngestionCursor,
  ISourceConnector,
  RawSourceRecord,
} from '../connector.js';

const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_WEB_BASE = 'https://www.reddit.com';

const DEFAULT_SUBREDDITS = ['forhire', 'jobbit', 'freelance'];
const DEFAULT_LISTING: RedditListing = 'new';
const DEFAULT_PER_PAGE = 25;

export type RedditListing = 'new' | 'hot';

export interface RedditConnectorOptions {
  subreddits?: string[];
  listing?: RedditListing;
  perPage?: number;
}

interface RedditTokenResponse {
  access_token: string;
  expires_in: number;
}

interface RedditChild {
  kind: string;
  data: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export class RedditConnector implements ISourceConnector {
  readonly sourceName = 'Reddit';
  readonly sourceType = 'reddit';

  private readonly subreddits: string[];
  private readonly listing: RedditListing;
  private readonly perPage: number;

  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(options: RedditConnectorOptions = {}) {
    this.subreddits = options.subreddits ?? [...DEFAULT_SUBREDDITS];
    this.listing = options.listing ?? DEFAULT_LISTING;
    this.perPage = options.perPage ?? DEFAULT_PER_PAGE;
  }

  private async getToken(signal?: AbortSignal): Promise<string> {
    const now = Date.now();
    if (this.token !== null && now < this.tokenExpiresAt) {
      return this.token;
    }

    const clientId = env.REDDIT_CLIENT_ID;
    const clientSecret = env.REDDIT_CLIENT_SECRET;
    const userAgent = env.REDDIT_USER_AGENT;

    if (clientId === undefined || clientSecret === undefined || userAgent === undefined) {
      throw new Error(
        'Reddit source requires REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT to be set',
      );
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(REDDIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      signal: signal ?? null,
    });

    if (!response.ok) {
      throw new Error(
        `Reddit token request failed with status ${response.status} ${response.statusText}`,
      );
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error('Reddit token response was not a JSON object');
    }

    const accessToken = asString(payload['access_token']);
    if (accessToken === undefined) {
      throw new Error('Reddit token response did not include an access_token');
    }

    const expiresIn = asNumber(payload['expires_in']) ?? 3600;
    this.token = accessToken;
    this.tokenExpiresAt = now + Math.max(0, expiresIn - 60) * 1000;

    return accessToken;
  }

  private mapChild(child: RedditChild, subreddit: string): RawSourceRecord | null {
    if (child.kind !== 't3') {
      return null;
    }

    const data = child.data;

    const title = asString(data['title']) ?? '';
    const selftext = asString(data['selftext']);
    const hasSelftext = selftext !== undefined && selftext.trim().length > 0;

    const content = hasSelftext ? `${title}\n\n${selftext}` : title;

    if (title.length === 0 && content.length === 0) {
      return null;
    }

    const name = asString(data['name']);
    if (name === undefined) {
      return null;
    }

    const permalink = asString(data['permalink']);
    const createdUtc = asNumber(data['created_utc']);

    const record: RawSourceRecord = {
      externalId: name,
      content,
      metadata: {
        subreddit: asString(data['subreddit']) ?? subreddit,
        score: asNumber(data['score']) ?? null,
        flair: asString(data['link_flair_text']) ?? null,
      },
    };

    if (permalink !== undefined) {
      record.url = `${REDDIT_WEB_BASE}${permalink}`;
    }

    if (title.length > 0) {
      record.title = title;
    }

    const author = asString(data['author']);
    if (author !== undefined) {
      record.authorKey = author;
    }

    if (createdUtc !== undefined) {
      record.publishedAt = new Date(createdUtc * 1000);
    }

    return record;
  }

  async fetch(cursor?: IngestionCursor, signal?: AbortSignal): Promise<IngestionBatch> {
    const rawSubIndex = cursor?.subredditIndex;
    const subIndex =
      typeof rawSubIndex === 'number' && Number.isInteger(rawSubIndex) && rawSubIndex >= 0
        ? rawSubIndex
        : 0;

    if (subIndex >= this.subreddits.length) {
      return { records: [], hasMore: false };
    }

    const subreddit = this.subreddits[subIndex] ?? '';
    const after = asString(cursor?.after);

    const token = await this.getToken(signal);

    const params = new URLSearchParams({ limit: String(this.perPage) });
    if (after !== undefined) {
      params.set('after', after);
    }

    const requestUrl = `${REDDIT_API_BASE}/r/${subreddit}/${this.listing}?${params.toString()}`;

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': env.REDDIT_USER_AGENT ?? '',
      },
      signal: signal ?? null,
    });

    if (!response.ok) {
      throw new Error(
        `Reddit listing request failed with status ${response.status} ${response.statusText}`,
      );
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error('Reddit listing response was not a JSON object');
    }

    const data = payload['data'];
    const listingData = isRecord(data) ? data : {};
    const rawChildren = listingData['children'];
    const children = Array.isArray(rawChildren) ? rawChildren : [];

    const records: RawSourceRecord[] = [];
    for (const child of children) {
      if (!isRecord(child)) {
        continue;
      }
      const kind = asString(child['kind']);
      const childData = child['data'];
      if (kind === undefined || !isRecord(childData)) {
        continue;
      }
      const record = this.mapChild({ kind, data: childData }, subreddit);
      if (record !== null) {
        records.push(record);
      }
    }

    const nextAfter = asString(listingData['after']);

    if (nextAfter !== undefined) {
      return {
        records,
        nextCursor: { subredditIndex: subIndex, after: nextAfter },
        hasMore: true,
      };
    }

    const nextSubIndex = subIndex + 1;
    return {
      records,
      nextCursor: { subredditIndex: nextSubIndex, after: undefined },
      hasMore: nextSubIndex < this.subreddits.length,
    };
  }
}
