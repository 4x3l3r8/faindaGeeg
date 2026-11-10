import { processSourceRecord } from '../ingestion/processing.js';
import { collapseWhitespace, hashContent } from '../../shared/hash.js';
import {
  findSourceRecordByHash,
  getOrCreateManualSource,
  insertSourceRecord,
} from './persistence.js';

export type SubmitResult =
  | { status: 'created'; opportunityId: string; totalScore: number }
  | { status: 'duplicate'; sourceRecordId: string; opportunityId: string | null }
  | { status: 'irrelevant'; sourceRecordId: string }
  | { status: 'needs_review'; sourceRecordId: string; reason: string };

export class SubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionError';
  }
}

const USER_AGENT = 'faindaGeeg-opportunity-bot/1.0 (+https://github.com/anomalyco/opencode)';

interface FetchedPage {
  title: string | null;
  text: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function htmlToText(html: string): FetchedPage {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const rawTitle = titleMatch?.[1];
  const decodedTitle = rawTitle === undefined ? '' : collapseWhitespace(decodeEntities(rawTitle));
  const title = decodedTitle.length > 0 ? decodedTitle : null;

  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]*>/g, ' ');
  const text = collapseWhitespace(decodeEntities(withoutTags));

  return { title, text };
}

async function fetchUrl(url: string): Promise<FetchedPage> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new SubmissionError(`Failed to fetch URL (${response.status} ${response.statusText})`);
  }

  const html = await response.text();
  return htmlToText(html);
}

function firstLineTitle(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, 120);
    }
  }

  return null;
}

export async function submitManual(input: { text?: string; url?: string }): Promise<SubmitResult> {
  const url = input.url?.trim();
  const hasUrl = url !== undefined && url.length > 0;

  let content: string;
  let title: string | null;

  if (hasUrl && url !== undefined) {
    const page = await fetchUrl(url);
    content = page.text;
    title = page.title;
  } else {
    const text = input.text;
    if (text === undefined || text.trim().length === 0) {
      throw new SubmissionError('No content to process');
    }
    content = text;
    title = firstLineTitle(text);
  }

  if (content.trim().length === 0) {
    throw new SubmissionError('No content to process');
  }

  const canonicalUrl = hasUrl ? url : null;
  const contentHash = hashContent(content);

  const source = await getOrCreateManualSource();
  const externalId = url ?? contentHash;

  const existing = await findSourceRecordByHash(source.id, contentHash);
  if (existing !== undefined) {
    return { status: 'duplicate', sourceRecordId: existing.id, opportunityId: null };
  }

  const sourceRecord = await insertSourceRecord({
    sourceId: source.id,
    externalId,
    canonicalUrl: canonicalUrl ?? null,
    title,
    contentText: content,
    contentHash,
    metadata: { submittedVia: hasUrl ? 'url' : 'text' },
  });

  const sourceRecordId = sourceRecord.id;

  const processed = await processSourceRecord(
    { id: sourceRecord.id, title: sourceRecord.title, content: sourceRecord.contentText },
    { sourceCredibility: 50 },
  );

  if (processed.status === 'needs_review') {
    return { status: 'needs_review', sourceRecordId, reason: processed.reason };
  }

  if (processed.status === 'irrelevant') {
    return { status: 'irrelevant', sourceRecordId };
  }

  return {
    status: 'created',
    opportunityId: processed.opportunityId,
    totalScore: processed.totalScore,
  };
}
