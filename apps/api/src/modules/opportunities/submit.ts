import { createHash } from 'node:crypto';

import {
  ExtractionValidationError,
  extractOpportunity,
  getAiProvider,
  type AiProvider,
  type ExtractionOutcome,
} from '../../ai/index.js';
import type { OpportunityType } from '../../shared/index.js';
import { SCORE_VERSION, scoreOpportunity } from '../scoring/index.js';
import { matchSkills } from '../skills/match.js';
import {
  findSourceRecordByHash,
  getOrCreateManualSource,
  insertOpportunityGraph,
  insertSourceRecord,
  listEnabledSkills,
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

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

function hashContent(content: string): string {
  return createHash('sha256').update(collapseWhitespace(content)).digest('hex');
}

async function tryExtract(
  record: { title: string | null; content: string },
  provider: AiProvider,
): Promise<ExtractionOutcome | null> {
  try {
    return await extractOpportunity(record, provider);
  } catch (error) {
    if (error instanceof ExtractionValidationError) {
      return null;
    }
    throw error;
  }
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

  const provider = getAiProvider();

  const outcome = await tryExtract({ title, content }, provider);
  if (outcome === null) {
    return {
      status: 'needs_review',
      sourceRecordId,
      reason: 'extraction failed schema validation',
    };
  }

  const result = outcome.result;

  if (result.classification === 'irrelevant' || result.isRelevant === false) {
    return { status: 'irrelevant', sourceRecordId };
  }

  const skills = await listEnabledSkills();
  const match = matchSkills(result.requiredSkills, skills);

  const opportunityType: OpportunityType = result.classification;

  const score = scoreOpportunity({
    opportunityType,
    buyingIntent: result.buyingIntent,
    urgency: result.urgency,
    budget: result.budget === null ? null : { min: result.budget.min, max: result.budget.max },
    commercialEvidence: result.commercialEvidence,
    skillMatch: match.stats,
    sourceCredibility: 50,
    publishedAt: null,
    now: new Date(),
  });

  const opportunityId = await insertOpportunityGraph({
    opportunity: {
      opportunityType,
      title: result.title,
      description: result.problemSummary,
      targetCustomer: result.targetCustomer,
      buyingIntent: result.buyingIntent,
      engagementType: result.engagementType,
      budgetMin: result.budget?.min ?? null,
      budgetMax: result.budget?.max ?? null,
      currency: result.budget?.currency ?? null,
      urgency: result.urgency,
      commercialEvidence: result.commercialEvidence,
      confidence: result.confidence,
    },
    evidence: result.evidenceExcerpts.map((item) => ({
      sourceRecordId,
      evidenceType: item.type,
      excerpt: item.excerpt,
      strength: null,
    })),
    skills: match.matches.map((item) => ({
      skillId: item.skillId,
      matchStrength: item.matchStrength,
      isRequired: item.isRequired,
      evidenceExcerpt: item.evidenceExcerpt,
    })),
    leadScore: {
      scoreVersion: SCORE_VERSION,
      skillFit: score.skillFit,
      buyingIntent: score.buyingIntent,
      commercialValue: score.commercialValue,
      urgency: score.urgency,
      freshness: score.freshness,
      credibility: score.credibility,
      totalScore: score.totalScore,
      explanation: {
        factors: score.explanation.factors,
        missingEvidence: score.explanation.missingEvidence,
      },
    },
  });

  return { status: 'created', opportunityId, totalScore: score.totalScore };
}
