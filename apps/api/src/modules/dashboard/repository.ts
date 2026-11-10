import { and, count, desc, eq, gte, inArray, isNotNull, max, sql } from 'drizzle-orm';
import { clientLeads, getDb, leadScores, opportunities, skills } from '@toi/db';

export interface DashboardSummary {
  totals: {
    opportunities: number;
    leads: number;
    skills: number;
  };
  opportunitiesByType: Array<{ type: string; count: number }>;
  opportunitiesByStatus: Array<{ status: string; count: number }>;
  highPriorityCount: number;
  recentOpportunities: Array<{
    id: string;
    title: string;
    opportunityType: string;
    createdAt: Date;
    totalScore: number | null;
  }>;
}

const HIGH_PRIORITY_THRESHOLD = 80;
const RECENT_OPPORTUNITY_LIMIT = 5;

const DIGEST_DEFAULT_SINCE_HOURS = 24;
const DIGEST_NEW_OPPORTUNITY_LIMIT = 20;
const DIGEST_HIGH_PRIORITY_LIMIT = 20;
const DIGEST_FOLLOW_UP_LIMIT = 50;

export interface DailyDigest {
  generatedAt: string;
  sinceHours: number;
  counts: {
    newOpportunities: number;
    highPriority: number;
    followUpsDue: number;
  };
  newOpportunities: Array<{
    id: string;
    title: string;
    opportunityType: string;
    createdAt: Date;
    totalScore: number | null;
  }>;
  highPriority: Array<{
    id: string;
    title: string;
    opportunityType: string;
    status: string;
    totalScore: number | null;
  }>;
  followUpsDue: Array<{
    leadId: string;
    opportunityId: string;
    title: string;
    status: string;
    nextActionAt: string;
  }>;
}

export async function getDailyDigest(
  params?: { sinceHours?: number },
): Promise<DailyDigest> {
  const db = getDb();
  const sinceHours = params?.sinceHours ?? DIGEST_DEFAULT_SINCE_HOURS;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const latestScores = db
    .select({
      opportunityId: leadScores.opportunityId,
      maxScoredAt: max(leadScores.scoredAt).as('max_scored_at'),
    })
    .from(leadScores)
    .groupBy(leadScores.opportunityId)
    .as('latest_scores');

  const newRows = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      opportunityType: opportunities.opportunityType,
      createdAt: opportunities.createdAt,
      totalScore: leadScores.totalScore,
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
    .where(gte(opportunities.createdAt, since))
    .orderBy(desc(opportunities.createdAt))
    .limit(DIGEST_NEW_OPPORTUNITY_LIMIT);

  const highPriorityRows = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      opportunityType: opportunities.opportunityType,
      status: opportunities.status,
      totalScore: leadScores.totalScore,
    })
    .from(opportunities)
    .innerJoin(latestScores, eq(latestScores.opportunityId, opportunities.id))
    .innerJoin(
      leadScores,
      and(
        eq(leadScores.opportunityId, opportunities.id),
        eq(leadScores.scoredAt, latestScores.maxScoredAt),
      ),
    )
    .where(
      and(
        gte(leadScores.totalScore, String(HIGH_PRIORITY_THRESHOLD)),
        inArray(opportunities.status, ['new', 'reviewing']),
      ),
    )
    .orderBy(desc(leadScores.totalScore))
    .limit(DIGEST_HIGH_PRIORITY_LIMIT);

  const followUpRows = await db
    .select({
      leadId: clientLeads.id,
      opportunityId: clientLeads.opportunityId,
      title: opportunities.title,
      status: opportunities.status,
      nextActionAt: clientLeads.nextActionAt,
    })
    .from(clientLeads)
    .innerJoin(opportunities, eq(opportunities.id, clientLeads.opportunityId))
    .where(
      and(
        isNotNull(clientLeads.nextActionAt),
        sql`${clientLeads.nextActionAt} <= now() + interval '24 hours'`,
      ),
    )
    .orderBy(clientLeads.nextActionAt)
    .limit(DIGEST_FOLLOW_UP_LIMIT);

  const newOpportunities = newRows.map((row) => ({
    id: row.id,
    title: row.title,
    opportunityType: row.opportunityType,
    createdAt: row.createdAt,
    totalScore: row.totalScore === null ? null : Number(row.totalScore),
  }));

  const highPriority = highPriorityRows.map((row) => ({
    id: row.id,
    title: row.title,
    opportunityType: row.opportunityType,
    status: row.status,
    totalScore: row.totalScore === null ? null : Number(row.totalScore),
  }));

  const followUpsDue = followUpRows.map((row) => ({
    leadId: row.leadId,
    opportunityId: row.opportunityId,
    title: row.title,
    status: row.status,
    nextActionAt: (row.nextActionAt ?? new Date()).toISOString(),
  }));

  return {
    generatedAt: new Date().toISOString(),
    sinceHours,
    counts: {
      newOpportunities: newOpportunities.length,
      highPriority: highPriority.length,
      followUpsDue: followUpsDue.length,
    },
    newOpportunities,
    highPriority,
    followUpsDue,
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const db = getDb();

  const opportunityCountRows = await db.select({ value: count() }).from(opportunities);
  const leadCountRows = await db.select({ value: count() }).from(clientLeads);
  const skillCountRows = await db.select({ value: count() }).from(skills);

  const byTypeRows = await db
    .select({ type: opportunities.opportunityType, count: count() })
    .from(opportunities)
    .groupBy(opportunities.opportunityType);

  const byStatusRows = await db
    .select({ status: opportunities.status, count: count() })
    .from(opportunities)
    .groupBy(opportunities.status);

  const latestScores = db
    .select({
      opportunityId: leadScores.opportunityId,
      maxScoredAt: max(leadScores.scoredAt).as('max_scored_at'),
    })
    .from(leadScores)
    .groupBy(leadScores.opportunityId)
    .as('latest_scores');

  const highPriorityRows = await db
    .select({ value: count() })
    .from(opportunities)
    .innerJoin(latestScores, eq(latestScores.opportunityId, opportunities.id))
    .innerJoin(
      leadScores,
      and(
        eq(leadScores.opportunityId, opportunities.id),
        eq(leadScores.scoredAt, latestScores.maxScoredAt),
      ),
    )
    .where(gte(leadScores.totalScore, String(HIGH_PRIORITY_THRESHOLD)));

  const recentRows = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      opportunityType: opportunities.opportunityType,
      createdAt: opportunities.createdAt,
      totalScore: leadScores.totalScore,
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
    .orderBy(desc(opportunities.createdAt))
    .limit(RECENT_OPPORTUNITY_LIMIT);

  return {
    totals: {
      opportunities: opportunityCountRows[0]?.value ?? 0,
      leads: leadCountRows[0]?.value ?? 0,
      skills: skillCountRows[0]?.value ?? 0,
    },
    opportunitiesByType: byTypeRows.map((row) => ({ type: row.type, count: row.count })),
    opportunitiesByStatus: byStatusRows.map((row) => ({ status: row.status, count: row.count })),
    highPriorityCount: highPriorityRows[0]?.value ?? 0,
    recentOpportunities: recentRows.map((row) => ({
      id: row.id,
      title: row.title,
      opportunityType: row.opportunityType,
      createdAt: row.createdAt,
      totalScore: row.totalScore === null ? null : Number(row.totalScore),
    })),
  };
}
