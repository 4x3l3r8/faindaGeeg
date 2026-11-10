import {
  ExtractionValidationError,
  extractOpportunity,
  getAiProvider,
  type ExtractionOutcome,
} from '../../ai/index.js';
import type { OpportunityType } from '../../shared/index.js';
import { insertOpportunityGraph, listEnabledSkills } from '../opportunities/persistence.js';
import { SCORE_VERSION, scoreOpportunity } from '../scoring/index.js';
import { matchSkills } from '../skills/match.js';

export type ProcessResult =
  | { status: 'created'; opportunityId: string; totalScore: number }
  | { status: 'irrelevant'; opportunityId: null }
  | { status: 'needs_review'; opportunityId: null; reason: string };

export interface ProcessSourceRecordTarget {
  id: string;
  title: string | null;
  content: string;
  publishedAt?: Date | null;
}

export interface ProcessSourceRecordOptions {
  sourceCredibility: number;
  now?: Date;
}

export async function processSourceRecord(
  record: ProcessSourceRecordTarget,
  opts: ProcessSourceRecordOptions,
): Promise<ProcessResult> {
  const provider = getAiProvider();

  let outcome: ExtractionOutcome;
  try {
    outcome = await extractOpportunity({ title: record.title, content: record.content }, provider);
  } catch (error) {
    if (error instanceof ExtractionValidationError) {
      return {
        status: 'needs_review',
        opportunityId: null,
        reason: 'extraction failed schema validation',
      };
    }
    throw error;
  }

  const result = outcome.result;

  if (result.classification === 'irrelevant' || result.isRelevant === false) {
    return { status: 'irrelevant', opportunityId: null };
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
    sourceCredibility: opts.sourceCredibility,
    publishedAt: record.publishedAt ?? null,
    now: opts.now ?? new Date(),
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
      sourceRecordId: record.id,
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
