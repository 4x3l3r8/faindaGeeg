import {
  and,
  asc,
  cosineDistance,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  min,
  notInArray,
  sql,
} from 'drizzle-orm';
import {
  clusterMembers,
  getDb,
  opportunities,
  opportunityEvidence,
  problemClusters,
  serviceIdeas,
  sourceRecords,
} from '@toi/db';
import type { ServiceIdeaResult } from '../../ai/service-ideas.js';

export interface OpportunityNeedingEmbedding {
  id: string;
  title: string;
  description: string;
}

export interface UnclusteredOpportunity {
  id: string;
  title: string;
  description: string;
  firstSeenAt: Date;
  embedding: number[];
}

export interface NearestCluster {
  id: string;
  similarity: number;
}

export interface CreateClusterInput {
  title: string;
  description: string | null;
  centroid: number[];
  firstObservedAt: Date;
}

export interface ListClustersParams {
  limit?: number;
}

export async function getOpportunitiesNeedingEmbedding(
  limit = 200,
): Promise<OpportunityNeedingEmbedding[]> {
  const db = getDb();

  return db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      description: opportunities.description,
    })
    .from(opportunities)
    .where(isNull(opportunities.embedding))
    .limit(limit);
}

export async function setOpportunityEmbedding(id: string, embedding: number[]): Promise<void> {
  const db = getDb();

  await db.update(opportunities).set({ embedding }).where(eq(opportunities.id, id));
}

export async function clearEmbeddingsAndClusters(): Promise<void> {
  const db = getDb();

  await db.update(opportunities).set({ embedding: null });
  await db.delete(problemClusters);
}

export async function getUnclusteredOpportunities(
  limit = 500,
): Promise<UnclusteredOpportunity[]> {
  const db = getDb();

  const clustered = db
    .select({ opportunityId: clusterMembers.opportunityId })
    .from(clusterMembers);

  const rows = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      description: opportunities.description,
      firstSeenAt: opportunities.firstSeenAt,
      embedding: opportunities.embedding,
    })
    .from(opportunities)
    .where(and(isNotNull(opportunities.embedding), notInArray(opportunities.id, clustered)))
    .orderBy(asc(opportunities.createdAt))
    .limit(limit);

  const result: UnclusteredOpportunity[] = [];
  for (const row of rows) {
    if (row.embedding !== null) {
      result.push({
        id: row.id,
        title: row.title,
        description: row.description,
        firstSeenAt: row.firstSeenAt,
        embedding: row.embedding,
      });
    }
  }

  return result;
}

export async function findNearestCluster(embedding: number[]): Promise<NearestCluster | null> {
  const db = getDb();

  const distance = cosineDistance(problemClusters.centroid, embedding);

  const rows = await db
    .select({ id: problemClusters.id, distance })
    .from(problemClusters)
    .where(isNotNull(problemClusters.centroid))
    .orderBy(asc(distance))
    .limit(1);

  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  return { id: row.id, similarity: 1 - Number(row.distance) };
}

export async function createCluster(input: CreateClusterInput): Promise<{ id: string }> {
  const db = getDb();

  const inserted = await db
    .insert(problemClusters)
    .values({
      title: input.title,
      description: input.description,
      centroid: input.centroid,
      memberCount: 0,
      independentSourceCount: 0,
      firstObservedAt: input.firstObservedAt,
    })
    .returning({ id: problemClusters.id });

  const row = inserted[0];
  if (row === undefined) {
    throw new Error('Failed to create the problem cluster');
  }

  return row;
}

export async function addClusterMember(
  clusterId: string,
  opportunityId: string,
  similarity: number,
): Promise<void> {
  const db = getDb();

  await db
    .insert(clusterMembers)
    .values({ clusterId, opportunityId, similarity: String(similarity) })
    .onConflictDoNothing();
}

export async function getClusterMemberEmbeddings(clusterId: string): Promise<number[][]> {
  const db = getDb();

  const rows = await db
    .select({ embedding: opportunities.embedding })
    .from(clusterMembers)
    .innerJoin(opportunities, eq(opportunities.id, clusterMembers.opportunityId))
    .where(and(eq(clusterMembers.clusterId, clusterId), isNotNull(opportunities.embedding)));

  const embeddings: number[][] = [];
  for (const row of rows) {
    if (row.embedding !== null) {
      embeddings.push(row.embedding);
    }
  }

  return embeddings;
}

export async function recomputeClusterMetrics(
  clusterId: string,
  centroid: number[],
): Promise<void> {
  const db = getDb();

  const memberCountRows = await db
    .select({ value: count() })
    .from(clusterMembers)
    .where(eq(clusterMembers.clusterId, clusterId));
  const memberCount = Number(memberCountRows[0]?.value ?? 0);

  const independentCountRows = await db
    .select({ value: countDistinct(sourceRecords.authorKey) })
    .from(clusterMembers)
    .innerJoin(opportunities, eq(opportunities.id, clusterMembers.opportunityId))
    .innerJoin(opportunityEvidence, eq(opportunityEvidence.opportunityId, opportunities.id))
    .innerJoin(sourceRecords, eq(sourceRecords.id, opportunityEvidence.sourceRecordId))
    .where(and(eq(clusterMembers.clusterId, clusterId), isNotNull(sourceRecords.authorKey)));
  const independentSourceCount = Number(independentCountRows[0]?.value ?? 0);

  const firstSeenRows = await db
    .select({ value: min(opportunities.firstSeenAt) })
    .from(clusterMembers)
    .innerJoin(opportunities, eq(opportunities.id, clusterMembers.opportunityId))
    .where(eq(clusterMembers.clusterId, clusterId));
  const minFirstSeenAt = firstSeenRows[0]?.value ?? null;

  const rawDemandScore = Math.min(100, independentSourceCount * 20 + memberCount * 5);
  const demandScore = Math.round(rawDemandScore * 100) / 100;

  const minFirstSeenIso =
    minFirstSeenAt === null
      ? null
      : minFirstSeenAt instanceof Date
        ? minFirstSeenAt.toISOString()
        : String(minFirstSeenAt);
  const firstObservedAtExpr =
    minFirstSeenIso === null
      ? null
      : sql`least(${problemClusters.firstObservedAt}, ${minFirstSeenIso}::timestamptz)`;

  await db
    .update(problemClusters)
    .set({
      centroid,
      memberCount,
      independentSourceCount,
      demandScore: String(demandScore),
      lastObservedAt: sql`now()`,
      ...(firstObservedAtExpr === null ? {} : { firstObservedAt: firstObservedAtExpr }),
    })
    .where(eq(problemClusters.id, clusterId));
}

export async function listClusters(params?: ListClustersParams) {
  const db = getDb();

  return db
    .select({
      id: problemClusters.id,
      title: problemClusters.title,
      description: problemClusters.description,
      targetAudience: problemClusters.targetAudience,
      problemCategory: problemClusters.problemCategory,
      memberCount: problemClusters.memberCount,
      independentSourceCount: problemClusters.independentSourceCount,
      demandScore: problemClusters.demandScore,
      validationStatus: problemClusters.validationStatus,
      firstObservedAt: problemClusters.firstObservedAt,
      lastObservedAt: problemClusters.lastObservedAt,
      createdAt: problemClusters.createdAt,
    })
    .from(problemClusters)
    .orderBy(sql`${problemClusters.demandScore} desc nulls last`, desc(problemClusters.createdAt))
    .limit(params?.limit ?? 100);
}

export async function createServiceIdea(
  clusterId: string | null,
  data: ServiceIdeaResult,
) {
  const db = getDb();

  const inserted = await db
    .insert(serviceIdeas)
    .values({
      clusterId,
      title: data.title,
      summary: data.summary,
      targetCustomer: data.targetCustomer,
      suggestedService: data.suggestedService,
      requiredSkills: data.requiredSkills,
      engagementModel: data.engagementModel,
      validationQuestions: data.validationQuestions,
      nextAction: data.nextAction,
    })
    .returning();

  const row = inserted[0];
  if (row === undefined) {
    throw new Error('Failed to create the service idea');
  }

  return row;
}

export async function listServiceIdeas(limit = 100) {
  const db = getDb();

  return db
    .select({
      id: serviceIdeas.id,
      clusterId: serviceIdeas.clusterId,
      clusterTitle: problemClusters.title,
      title: serviceIdeas.title,
      summary: serviceIdeas.summary,
      targetCustomer: serviceIdeas.targetCustomer,
      suggestedService: serviceIdeas.suggestedService,
      requiredSkills: serviceIdeas.requiredSkills,
      engagementModel: serviceIdeas.engagementModel,
      validationQuestions: serviceIdeas.validationQuestions,
      nextAction: serviceIdeas.nextAction,
      createdAt: serviceIdeas.createdAt,
    })
    .from(serviceIdeas)
    .leftJoin(problemClusters, eq(problemClusters.id, serviceIdeas.clusterId))
    .orderBy(desc(serviceIdeas.createdAt))
    .limit(limit);
}

export async function getClusterDetail(id: string) {
  const db = getDb();

  const clusterRows = await db
    .select({
      id: problemClusters.id,
      title: problemClusters.title,
      description: problemClusters.description,
      targetAudience: problemClusters.targetAudience,
      problemCategory: problemClusters.problemCategory,
      memberCount: problemClusters.memberCount,
      independentSourceCount: problemClusters.independentSourceCount,
      demandScore: problemClusters.demandScore,
      validationStatus: problemClusters.validationStatus,
      firstObservedAt: problemClusters.firstObservedAt,
      lastObservedAt: problemClusters.lastObservedAt,
      createdAt: problemClusters.createdAt,
    })
    .from(problemClusters)
    .where(eq(problemClusters.id, id))
    .limit(1);

  const cluster = clusterRows[0];
  if (cluster === undefined) {
    return null;
  }

  const memberRows = await db
    .select({
      opportunityId: opportunities.id,
      title: opportunities.title,
      opportunityType: opportunities.opportunityType,
      similarity: clusterMembers.similarity,
    })
    .from(clusterMembers)
    .innerJoin(opportunities, eq(opportunities.id, clusterMembers.opportunityId))
    .where(eq(clusterMembers.clusterId, id));

  const memberIds = memberRows.map((member) => member.opportunityId);

  const firstEvidence = new Map<string, { excerpt: string; sourceUrl: string | null }>();

  if (memberIds.length > 0) {
    const evidenceRows = await db
      .select({
        opportunityId: opportunityEvidence.opportunityId,
        excerpt: opportunityEvidence.excerpt,
        sourceUrl: sourceRecords.canonicalUrl,
        createdAt: opportunityEvidence.createdAt,
      })
      .from(opportunityEvidence)
      .innerJoin(sourceRecords, eq(sourceRecords.id, opportunityEvidence.sourceRecordId))
      .where(inArray(opportunityEvidence.opportunityId, memberIds))
      .orderBy(asc(opportunityEvidence.createdAt));

    for (const row of evidenceRows) {
      if (!firstEvidence.has(row.opportunityId)) {
        firstEvidence.set(row.opportunityId, {
          excerpt: row.excerpt,
          sourceUrl: row.sourceUrl,
        });
      }
    }
  }

  const ideas = await db
    .select()
    .from(serviceIdeas)
    .where(eq(serviceIdeas.clusterId, id));

  const members = memberRows.map((member) => {
    const evidence = firstEvidence.get(member.opportunityId);
    return {
      opportunityId: member.opportunityId,
      title: member.title,
      opportunityType: member.opportunityType,
      similarity: member.similarity,
      evidenceExcerpt: evidence?.excerpt ?? null,
      sourceUrl: evidence?.sourceUrl ?? null,
    };
  });

  return { ...cluster, members, serviceIdeas: ideas };
}
