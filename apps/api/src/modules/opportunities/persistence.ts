import { and, count, desc, eq, gte, ilike, inArray, max, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  getDb,
  leadScores,
  opportunities,
  opportunityEvidence,
  opportunityFeedback,
  opportunitySkills,
  skills,
  sourceRecords,
  sources,
} from '@toi/db';

import type {
  BuyingIntent,
  EngagementType,
  EvidenceType,
  OpportunityStatus,
  OpportunityType,
} from '../../shared/index.js';
import type { DbSkill } from '../skills/match.js';

export interface ManualSource {
  id: string;
}

export interface SourceRecordInput {
  sourceId: string;
  externalId: string;
  canonicalUrl: string | null;
  title: string | null;
  contentText: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

export interface OpportunityGraphInput {
  opportunity: {
    opportunityType: OpportunityType;
    title: string;
    description: string;
    targetCustomer: string | null;
    buyingIntent: BuyingIntent;
    engagementType: EngagementType;
    budgetMin: number | null;
    budgetMax: number | null;
    currency: string | null;
    urgency: number | null;
    commercialEvidence: string | null;
    confidence: number | null;
  };
  evidence: Array<{
    sourceRecordId: string;
    evidenceType: EvidenceType;
    excerpt: string;
    strength: number | null;
  }>;
  skills: Array<{
    skillId: string;
    matchStrength: number | null;
    isRequired: boolean;
    evidenceExcerpt: string | null;
  }>;
  leadScore: {
    scoreVersion: string;
    skillFit: number;
    buyingIntent: number;
    commercialValue: number;
    urgency: number;
    freshness: number;
    credibility: number;
    totalScore: number;
    explanation: Record<string, unknown>;
  };
}

export interface ListOpportunitiesParams {
  page: number;
  pageSize: number;
  opportunityType?: OpportunityType;
  status?: OpportunityStatus;
  buyingIntent?: BuyingIntent;
  minScore?: number;
  sourceId?: string;
  search?: string;
}

export interface FeedbackInput {
  opportunityId: string;
  isRelevant: boolean | null;
  rating: number | null;
  notes: string | null;
}

function toNumeric(value: number | null): string | null {
  return value === null ? null : String(value);
}

export async function getOrCreateManualSource(): Promise<ManualSource> {
  const db = getDb();

  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.sourceType, 'manual'), eq(sources.name, 'Manual Submission')))
    .limit(1);

  const found = existing[0];
  if (found !== undefined) {
    return found;
  }

  const inserted = await db
    .insert(sources)
    .values({ name: 'Manual Submission', sourceType: 'manual' })
    .returning({ id: sources.id });

  const created = inserted[0];
  if (created === undefined) {
    throw new Error('Failed to create the manual submission source');
  }

  return created;
}

export async function findSourceRecordByHash(
  sourceId: string,
  contentHash: string,
): Promise<typeof sourceRecords.$inferSelect | undefined> {
  const db = getDb();

  const rows = await db
    .select()
    .from(sourceRecords)
    .where(and(eq(sourceRecords.sourceId, sourceId), eq(sourceRecords.contentHash, contentHash)))
    .limit(1);

  return rows[0];
}

export async function insertSourceRecord(
  data: SourceRecordInput,
): Promise<typeof sourceRecords.$inferSelect> {
  const db = getDb();

  const inserted = await db
    .insert(sourceRecords)
    .values({
      sourceId: data.sourceId,
      externalId: data.externalId,
      canonicalUrl: data.canonicalUrl,
      title: data.title,
      contentText: data.contentText,
      contentHash: data.contentHash,
      ...(data.metadata === undefined ? {} : { metadata: data.metadata }),
    })
    .returning();

  const row = inserted[0];
  if (row === undefined) {
    throw new Error('Failed to insert the source record');
  }

  return row;
}

export async function listEnabledSkills(): Promise<DbSkill[]> {
  const db = getDb();

  return db
    .select({
      id: skills.id,
      name: skills.name,
      aliases: skills.aliases,
      proficiency: skills.proficiency,
      isEnabled: skills.isEnabled,
    })
    .from(skills)
    .where(eq(skills.isEnabled, true));
}

export async function insertOpportunityGraph(input: OpportunityGraphInput): Promise<string> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(opportunities)
      .values({
        opportunityType: input.opportunity.opportunityType,
        title: input.opportunity.title,
        description: input.opportunity.description,
        targetCustomer: input.opportunity.targetCustomer,
        buyingIntent: input.opportunity.buyingIntent,
        engagementType: input.opportunity.engagementType,
        budgetMin: toNumeric(input.opportunity.budgetMin),
        budgetMax: toNumeric(input.opportunity.budgetMax),
        currency: input.opportunity.currency,
        urgency: input.opportunity.urgency,
        commercialEvidence: input.opportunity.commercialEvidence,
        confidence: toNumeric(input.opportunity.confidence),
        status: 'new',
      })
      .returning({ id: opportunities.id });

    const opportunityId = inserted[0]?.id;
    if (opportunityId === undefined) {
      throw new Error('Failed to insert the opportunity');
    }

    if (input.evidence.length > 0) {
      await tx.insert(opportunityEvidence).values(
        input.evidence.map((item) => ({
          opportunityId,
          sourceRecordId: item.sourceRecordId,
          evidenceType: item.evidenceType,
          excerpt: item.excerpt,
          strength: toNumeric(item.strength),
        })),
      );
    }

    if (input.skills.length > 0) {
      await tx.insert(opportunitySkills).values(
        input.skills.map((item) => ({
          opportunityId,
          skillId: item.skillId,
          matchStrength: toNumeric(item.matchStrength),
          isRequired: item.isRequired,
          evidenceExcerpt: item.evidenceExcerpt,
        })),
      );
    }

    await tx.insert(leadScores).values({
      opportunityId,
      scoreVersion: input.leadScore.scoreVersion,
      skillFit: String(input.leadScore.skillFit),
      buyingIntent: String(input.leadScore.buyingIntent),
      commercialValue: String(input.leadScore.commercialValue),
      urgency: String(input.leadScore.urgency),
      freshness: String(input.leadScore.freshness),
      credibility: String(input.leadScore.credibility),
      totalScore: String(input.leadScore.totalScore),
      explanation: input.leadScore.explanation,
    });

    return opportunityId;
  });
}

export async function listOpportunities(params: ListOpportunitiesParams) {
  const db = getDb();

  const conditions: SQL[] = [];

  if (params.opportunityType !== undefined) {
    conditions.push(eq(opportunities.opportunityType, params.opportunityType));
  }

  if (params.status !== undefined) {
    conditions.push(eq(opportunities.status, params.status));
  }

  if (params.buyingIntent !== undefined) {
    conditions.push(eq(opportunities.buyingIntent, params.buyingIntent));
  }

  if (params.minScore !== undefined) {
    conditions.push(gte(leadScores.totalScore, String(params.minScore)));
  }

  if (params.search !== undefined && params.search.trim() !== '') {
    const term = `%${params.search.trim()}%`;
    const searchCondition = or(
      ilike(opportunities.title, term),
      ilike(opportunities.description, term),
    );
    if (searchCondition !== undefined) {
      conditions.push(searchCondition);
    }
  }

  if (params.sourceId !== undefined) {
    const evidenceForSource = db
      .select({ opportunityId: opportunityEvidence.opportunityId })
      .from(opportunityEvidence)
      .innerJoin(sourceRecords, eq(sourceRecords.id, opportunityEvidence.sourceRecordId))
      .where(eq(sourceRecords.sourceId, params.sourceId));

    conditions.push(inArray(opportunities.id, evidenceForSource));
  }

  const latestScores = db
    .select({
      opportunityId: leadScores.opportunityId,
      maxScoredAt: max(leadScores.scoredAt).as('max_scored_at'),
    })
    .from(leadScores)
    .groupBy(leadScores.opportunityId)
    .as('latest_scores');

  const where = and(...conditions);

  const rows = await db
    .select({
      id: opportunities.id,
      opportunityType: opportunities.opportunityType,
      title: opportunities.title,
      description: opportunities.description,
      targetCustomer: opportunities.targetCustomer,
      buyingIntent: opportunities.buyingIntent,
      engagementType: opportunities.engagementType,
      budgetMin: opportunities.budgetMin,
      budgetMax: opportunities.budgetMax,
      currency: opportunities.currency,
      urgency: opportunities.urgency,
      commercialEvidence: opportunities.commercialEvidence,
      confidence: opportunities.confidence,
      status: opportunities.status,
      firstSeenAt: opportunities.firstSeenAt,
      lastSeenAt: opportunities.lastSeenAt,
      createdAt: opportunities.createdAt,
      leadScore: {
        id: leadScores.id,
        scoreVersion: leadScores.scoreVersion,
        skillFit: leadScores.skillFit,
        buyingIntent: leadScores.buyingIntent,
        commercialValue: leadScores.commercialValue,
        urgency: leadScores.urgency,
        freshness: leadScores.freshness,
        credibility: leadScores.credibility,
        totalScore: leadScores.totalScore,
        scoredAt: leadScores.scoredAt,
      },
    })
    .from(opportunities)
    .leftJoin(latestScores, eq(latestScores.opportunityId, opportunities.id))
    .leftJoin(
      leadScores,
      and(
        eq(leadScores.opportunityId, opportunities.id),
        eq(leadScores.scoredAt, latestScores.maxScoredAt),
      ),
    )
    .where(where)
    .orderBy(sql`${leadScores.totalScore} desc nulls last`, desc(opportunities.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const totalRows = await db
    .select({ value: count() })
    .from(opportunities)
    .leftJoin(latestScores, eq(latestScores.opportunityId, opportunities.id))
    .leftJoin(
      leadScores,
      and(
        eq(leadScores.opportunityId, opportunities.id),
        eq(leadScores.scoredAt, latestScores.maxScoredAt),
      ),
    )
    .where(where);

  const total = totalRows[0]?.value ?? 0;

  return { rows, total };
}

export async function getOpportunityDetail(id: string) {
  const db = getDb();

  const opportunityRows = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, id))
    .limit(1);

  const opportunity = opportunityRows[0];
  if (opportunity === undefined) {
    return null;
  }

  const evidence = await db
    .select({
      id: opportunityEvidence.id,
      opportunityId: opportunityEvidence.opportunityId,
      sourceRecordId: opportunityEvidence.sourceRecordId,
      evidenceType: opportunityEvidence.evidenceType,
      excerpt: opportunityEvidence.excerpt,
      strength: opportunityEvidence.strength,
      createdAt: opportunityEvidence.createdAt,
      sourceRecordUrl: sourceRecords.canonicalUrl,
      sourceRecordTitle: sourceRecords.title,
    })
    .from(opportunityEvidence)
    .innerJoin(sourceRecords, eq(sourceRecords.id, opportunityEvidence.sourceRecordId))
    .where(eq(opportunityEvidence.opportunityId, id));

  const matchedSkills = await db
    .select({
      skillId: opportunitySkills.skillId,
      name: skills.name,
      matchStrength: opportunitySkills.matchStrength,
      isRequired: opportunitySkills.isRequired,
      evidenceExcerpt: opportunitySkills.evidenceExcerpt,
    })
    .from(opportunitySkills)
    .innerJoin(skills, eq(skills.id, opportunitySkills.skillId))
    .where(eq(opportunitySkills.opportunityId, id));

  const leadScoreRows = await db
    .select()
    .from(leadScores)
    .where(eq(leadScores.opportunityId, id))
    .orderBy(desc(leadScores.scoredAt))
    .limit(1);

  return {
    ...opportunity,
    evidence,
    skills: matchedSkills,
    leadScore: leadScoreRows[0] ?? null,
  };
}

export async function insertFeedback(
  data: FeedbackInput,
): Promise<typeof opportunityFeedback.$inferSelect | undefined> {
  const db = getDb();

  const inserted = await db
    .insert(opportunityFeedback)
    .values({
      opportunityId: data.opportunityId,
      isRelevant: data.isRelevant,
      rating: data.rating,
      notes: data.notes,
    })
    .returning();

  return inserted[0];
}

export async function updateOpportunityStatus(id: string, status: string): Promise<void> {
  const db = getDb();

  await db
    .update(opportunities)
    .set({ status: status as OpportunityStatus })
    .where(eq(opportunities.id, id));
}
