import { and, count, desc, eq, gte, max } from 'drizzle-orm';
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
