import { parse } from 'csv-parse/sync';

import { env } from '../../../config/env.js';
import { hashContent } from '../../../shared/hash.js';
import type {
  IngestionBatch,
  IngestionCursor,
  ISourceConnector,
  RawSourceRecord,
} from '../connector.js';

const SOURCE_NAME = 'Google Sheets';
const SOURCE_TYPE = 'other';

export interface GoogleSheetsConnectorOptions {
  csvUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const text = asString(value);
    if (text !== undefined) {
      normalized[key.trim().toLowerCase()] = text;
    }
  }
  return normalized;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export class GoogleSheetsConnector implements ISourceConnector {
  readonly sourceName = SOURCE_NAME;
  readonly sourceType = SOURCE_TYPE;

  private readonly csvUrl: string | undefined;

  constructor(options: GoogleSheetsConnectorOptions = {}) {
    this.csvUrl = options.csvUrl ?? env.GOOGLE_SHEETS_CSV_URL;
  }

  private mapRow(row: Record<string, string>): RawSourceRecord | null {
    const content = row['content'];
    if (content === undefined || content.length === 0) {
      return null;
    }

    const url = row['url'];
    const externalId =
      firstNonEmpty(row['externalid'], url) ?? hashContent(content);

    const record: RawSourceRecord = {
      externalId,
      content,
      metadata: { via: 'google-sheets' },
    };

    if (url !== undefined && url.length > 0) {
      record.url = url;
    }

    const title = row['title'];
    if (title !== undefined && title.length > 0) {
      record.title = title;
    }

    const author = row['author'];
    if (author !== undefined && author.length > 0) {
      record.authorKey = author;
    }

    const publishedRaw = row['publishedat'];
    if (publishedRaw !== undefined && publishedRaw.length > 0) {
      const publishedAt = new Date(publishedRaw);
      if (!Number.isNaN(publishedAt.getTime())) {
        record.publishedAt = publishedAt;
      }
    }

    return record;
  }

  async fetch(_cursor?: IngestionCursor, signal?: AbortSignal): Promise<IngestionBatch> {
    const csvUrl = this.csvUrl;
    if (csvUrl === undefined) {
      throw new Error('Google Sheets source requires GOOGLE_SHEETS_CSV_URL');
    }

    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: { Accept: 'text/csv' },
      signal: signal ?? null,
    });

    if (!response.ok) {
      throw new Error(
        `Google Sheets CSV request failed with status ${response.status} ${response.statusText}`,
      );
    }

    const body = await response.text();
    const parsed: unknown = parse(body, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    const rows = Array.isArray(parsed) ? parsed : [];

    const records: RawSourceRecord[] = [];
    for (const row of rows) {
      if (!isRecord(row)) {
        continue;
      }
      const record = this.mapRow(normalizeRow(row));
      if (record !== null) {
        records.push(record);
      }
    }

    return { records, hasMore: false };
  }
}
