import { XMLParser } from 'fast-xml-parser';

import { env } from '../../../config/env.js';
import { hashContent } from '../../../shared/hash.js';
import { stripHtml } from '../../../shared/text.js';
import type {
  IngestionBatch,
  IngestionCursor,
  ISourceConnector,
  RawSourceRecord,
} from '../connector.js';

export interface RssConnectorOptions {
  feedUrls?: string[];
}

interface FeedItemFields {
  title: string;
  link: string;
  contentHtml: string;
  guid: string;
  dateText: string;
  author: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

function coerceText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (isRecord(value)) {
    const text = value['#text'];
    if (typeof text === 'string') {
      return text;
    }
    if (typeof text === 'number') {
      return String(text);
    }
  }
  return '';
}

function resolveAtomLink(value: unknown): string | undefined {
  let firstHref: string | undefined;
  for (const link of toArray(value)) {
    if (!isRecord(link)) {
      continue;
    }
    const href = link['@_href'];
    if (typeof href !== 'string' || href.length === 0) {
      continue;
    }
    if (link['@_rel'] === 'alternate') {
      return href;
    }
    if (firstHref === undefined) {
      firstHref = href;
    }
  }
  return firstHref;
}

function parseRss(parsed: Record<string, unknown>): FeedItemFields[] {
  const rss = parsed['rss'];
  if (!isRecord(rss)) {
    return [];
  }
  const channel = rss['channel'];
  if (!isRecord(channel)) {
    return [];
  }

  const items: FeedItemFields[] = [];
  for (const item of toArray(channel['item'])) {
    if (!isRecord(item)) {
      continue;
    }
    items.push({
      title: coerceText(item['title']),
      link: coerceText(item['link']),
      contentHtml: coerceText(item['description'] ?? item['content:encoded']),
      guid: coerceText(item['guid']),
      dateText: coerceText(item['pubDate']),
      author: coerceText(item['dc:creator'] ?? item['author']),
    });
  }
  return items;
}

function parseAtom(parsed: Record<string, unknown>): FeedItemFields[] {
  const feed = parsed['feed'];
  if (!isRecord(feed)) {
    return [];
  }

  const entries: FeedItemFields[] = [];
  for (const entry of toArray(feed['entry'])) {
    if (!isRecord(entry)) {
      continue;
    }

    const rawAuthor = entry['author'];
    const author = isRecord(rawAuthor)
      ? coerceText(rawAuthor['name'])
      : coerceText(rawAuthor);

    const content =
      coerceText(entry['summary']) || coerceText(entry['content']);

    entries.push({
      title: coerceText(entry['title']),
      link: resolveAtomLink(entry['link']) ?? coerceText(entry['link']),
      contentHtml: content,
      guid: coerceText(entry['id']),
      dateText: coerceText(entry['updated']) || coerceText(entry['published']),
      author,
    });
  }
  return entries;
}

function mapItem(item: FeedItemFields, feedUrl: string): RawSourceRecord | null {
  const title = item.title.trim();
  const content = stripHtml(item.contentHtml);

  if (title.length === 0 && content.length === 0) {
    return null;
  }

  const guid = item.guid.trim();
  const link = item.link.trim();

  const externalId =
    guid.length > 0 ? guid : link.length > 0 ? link : hashContent(`${title}${content}`);

  const record: RawSourceRecord = {
    externalId,
    content,
    metadata: { feedUrl },
  };

  if (link.length > 0) {
    record.url = link;
  }

  if (title.length > 0) {
    record.title = title;
  }

  const author = item.author.trim();
  if (author.length > 0) {
    record.authorKey = author;
  }

  const dateText = item.dateText.trim();
  if (dateText.length > 0) {
    const publishedAt = new Date(dateText);
    if (!Number.isNaN(publishedAt.getTime())) {
      record.publishedAt = publishedAt;
    }
  }

  return record;
}

export class RssConnector implements ISourceConnector {
  readonly sourceName = 'RSS';
  readonly sourceType = 'other';

  private readonly feedUrls: string[];
  private readonly parser: XMLParser;

  constructor(options: RssConnectorOptions = {}) {
    this.feedUrls =
      options.feedUrls ??
      env.RSS_FEED_URLS?.split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0) ??
      [];
    // processEntities:false avoids fast-xml-parser's entity-expansion limit on
    // feeds with many &amp;-style entities; stripHtml() decodes what we need.
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      processEntities: false,
    });
  }

  async fetch(cursor?: IngestionCursor, signal?: AbortSignal): Promise<IngestionBatch> {
    const rawFeedIndex = cursor?.feedIndex;
    const feedIndex = typeof rawFeedIndex === 'number' ? rawFeedIndex : 0;

    if (this.feedUrls.length === 0) {
      throw new Error('RSS source requires RSS_FEED_URLS');
    }

    if (feedIndex >= this.feedUrls.length) {
      return { records: [], hasMore: false };
    }

    const feedUrl = this.feedUrls[feedIndex];
    if (feedUrl === undefined) {
      return { records: [], hasMore: false };
    }

    const response = await fetch(feedUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: signal ?? null,
    });

    if (!response.ok) {
      throw new Error(
        `RSS feed request failed for ${feedUrl} with status ${response.status} ${response.statusText}`,
      );
    }

    const xml = await response.text();
    const parsed: unknown = this.parser.parse(xml);
    if (!isRecord(parsed)) {
      throw new Error(`RSS feed ${feedUrl} did not parse to an XML object`);
    }

    const items = [...parseRss(parsed), ...parseAtom(parsed)];

    const records: RawSourceRecord[] = [];
    for (const item of items) {
      const record = mapItem(item, feedUrl);
      if (record !== null) {
        records.push(record);
      }
    }

    const nextIndex = feedIndex + 1;

    return {
      records,
      nextCursor: { feedIndex: nextIndex },
      hasMore: nextIndex < this.feedUrls.length,
    };
  }
}
