import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const agnosticVector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector';
  },
  toDriver(value) {
    return '[' + value.join(',') + ']';
  },
  fromDriver(value) {
    return (typeof value === 'string' ? JSON.parse(value) : value) as number[];
  },
});

export const opportunityTypeEnum = pgEnum('opportunity_type', ['gig', 'problem', 'product_gap']);

export const buyingIntentEnum = pgEnum('buying_intent', ['explicit', 'implied', 'unknown']);

export const engagementTypeEnum = pgEnum('engagement_type', [
  'fixed_project',
  'contract',
  'retainer',
  'unknown',
]);

export const opportunityStatusEnum = pgEnum('opportunity_status', [
  'new',
  'reviewing',
  'qualified',
  'contacted',
  'replied',
  'discussion',
  'proposal',
  'won',
  'lost',
  'rejected',
  'archived',
]);

export const sourceTypeEnum = pgEnum('source_type', [
  'reddit',
  'x',
  'facebook',
  'instagram',
  'github',
  'job_board',
  'review',
  'manual',
  'other',
]);

export const evidenceTypeEnum = pgEnum('evidence_type', ['quote', 'summary', 'link', 'other']);

export const outreachActivityTypeEnum = pgEnum('outreach_activity_type', [
  'note',
  'draft',
  'contact',
  'reply',
  'proposal',
  'status_change',
  'other',
]);

export const ingestionStatusEnum = pgEnum('ingestion_status', [
  'pending',
  'running',
  'success',
  'failed',
  'partial',
]);

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  lastSuccessfulSyncAt: timestamp('last_successful_sync_at', { withTimezone: true }),
  // Never store secrets in this column.
  configuration: jsonb('configuration').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sourceRecords = pgTable(
  'source_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id),
    externalId: text('external_id').notNull(),
    canonicalUrl: text('canonical_url'),
    authorKey: text('author_key'),
    title: text('title'),
    contentText: text('content_text').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    collectedAt: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
    contentHash: text('content_hash').notNull(),
    language: text('language'),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => [
    uniqueIndex('source_records_source_id_external_id_unique').on(table.sourceId, table.externalId),
    index('source_records_content_hash_idx').on(table.contentHash),
  ],
);

export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => sources.id),
    status: ingestionStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    recordsFetched: integer('records_fetched').notNull().default(0),
    recordsNew: integer('records_new').notNull().default(0),
    recordsProcessed: integer('records_processed').notNull().default(0),
    opportunitiesCreated: integer('opportunities_created').notNull().default(0),
    error: text('error'),
    cursor: jsonb('cursor'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ingestion_runs_source_id_idx').on(table.sourceId),
    index('ingestion_runs_created_at_idx').on(table.createdAt),
  ],
);

export const opportunities = pgTable(
  'opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityType: opportunityTypeEnum('opportunity_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    targetCustomer: text('target_customer'),
    buyingIntent: buyingIntentEnum('buying_intent').notNull().default('unknown'),
    engagementType: engagementTypeEnum('engagement_type').notNull().default('unknown'),
    budgetMin: numeric('budget_min'),
    budgetMax: numeric('budget_max'),
    currency: text('currency'),
    urgency: integer('urgency'),
    commercialEvidence: text('commercial_evidence'),
    confidence: numeric('confidence'),
    status: opportunityStatusEnum('status').notNull().default('new'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    embedding: agnosticVector('embedding'),
  },
  (table) => [
    index('opportunities_status_idx').on(table.status),
    index('opportunities_opportunity_type_idx').on(table.opportunityType),
  ],
);

export const opportunityEvidence = pgTable(
  'opportunity_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    sourceRecordId: uuid('source_record_id')
      .notNull()
      .references(() => sourceRecords.id),
    evidenceType: evidenceTypeEnum('evidence_type').notNull().default('quote'),
    excerpt: text('excerpt').notNull(),
    strength: numeric('strength'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('opportunity_evidence_opportunity_id_idx').on(table.opportunityId)],
);

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  category: text('category').notNull(),
  aliases: text('aliases')
    .array()
    .notNull()
    .default(sql`'{}'`),
  isEnabled: boolean('is_enabled').notNull().default(true),
  proficiency: integer('proficiency'),
});

export const opportunitySkills = pgTable(
  'opportunity_skills',
  {
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    matchStrength: numeric('match_strength'),
    isRequired: boolean('is_required').notNull().default(false),
    evidenceExcerpt: text('evidence_excerpt'),
  },
  (table) => [primaryKey({ columns: [table.opportunityId, table.skillId] })],
);

export const leadScores = pgTable(
  'lead_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    scoreVersion: text('score_version').notNull(),
    skillFit: numeric('skill_fit').notNull(),
    buyingIntent: numeric('buying_intent').notNull(),
    commercialValue: numeric('commercial_value').notNull(),
    urgency: numeric('urgency').notNull(),
    freshness: numeric('freshness').notNull(),
    credibility: numeric('credibility').notNull(),
    totalScore: numeric('total_score').notNull(),
    explanation: jsonb('explanation').notNull().default({}),
    scoredAt: timestamp('scored_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('lead_scores_opportunity_id_scored_at_idx').on(table.opportunityId, table.scoredAt),
  ],
);

export const clientLeads = pgTable('client_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id')
    .notNull()
    .unique()
    .references(() => opportunities.id),
  status: opportunityStatusEnum('status').notNull().default('new'),
  notes: text('notes'),
  nextActionAt: timestamp('next_action_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const outreachActivities = pgTable('outreach_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientLeadId: uuid('client_lead_id')
    .notNull()
    .references(() => clientLeads.id, { onDelete: 'cascade' }),
  activityType: outreachActivityTypeEnum('activity_type').notNull(),
  content: text('content'),
  outcome: text('outcome'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const opportunityFeedback = pgTable('opportunity_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.id, { onDelete: 'cascade' }),
  isRelevant: boolean('is_relevant'),
  rating: integer('rating'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clusterValidationStatusEnum = pgEnum('cluster_validation_status', [
  'unvalidated',
  'investigating',
  'validated',
  'rejected',
]);

export const problemClusters = pgTable('problem_clusters', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  targetAudience: text('target_audience'),
  problemCategory: text('problem_category'),
  centroid: agnosticVector('centroid'),
  memberCount: integer('member_count').notNull().default(0),
  independentSourceCount: integer('independent_source_count').notNull().default(0),
  demandScore: numeric('demand_score'),
  validationStatus: clusterValidationStatusEnum('validation_status').notNull().default('unvalidated'),
  firstObservedAt: timestamp('first_observed_at', { withTimezone: true }).notNull().defaultNow(),
  lastObservedAt: timestamp('last_observed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clusterMembers = pgTable(
  'cluster_members',
  {
    clusterId: uuid('cluster_id')
      .notNull()
      .references(() => problemClusters.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    similarity: numeric('similarity'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.clusterId, table.opportunityId] }),
    index('cluster_members_opportunity_id_idx').on(table.opportunityId),
  ],
);

export const serviceIdeas = pgTable('service_ideas', {
  id: uuid('id').primaryKey().defaultRandom(),
  clusterId: uuid('cluster_id').references(() => problemClusters.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  targetCustomer: text('target_customer'),
  suggestedService: text('suggested_service').notNull(),
  requiredSkills: text('required_skills')
    .array()
    .notNull()
    .default(sql`'{}'`),
  engagementModel: text('engagement_model'),
  validationQuestions: text('validation_questions')
    .array()
    .notNull()
    .default(sql`'{}'`),
  nextAction: text('next_action'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sourcesRelations = relations(sources, ({ many }) => ({
  sourceRecords: many(sourceRecords),
  ingestionRuns: many(ingestionRuns),
}));

export const sourceRecordsRelations = relations(sourceRecords, ({ one, many }) => ({
  source: one(sources, {
    fields: [sourceRecords.sourceId],
    references: [sources.id],
  }),
  opportunityEvidence: many(opportunityEvidence),
}));

export const opportunitiesRelations = relations(opportunities, ({ many, one }) => ({
  opportunityEvidence: many(opportunityEvidence),
  opportunitySkills: many(opportunitySkills),
  leadScores: many(leadScores),
  clientLead: one(clientLeads, {
    fields: [opportunities.id],
    references: [clientLeads.opportunityId],
  }),
  opportunityFeedback: many(opportunityFeedback),
}));

export const opportunityEvidenceRelations = relations(opportunityEvidence, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityEvidence.opportunityId],
    references: [opportunities.id],
  }),
  sourceRecord: one(sourceRecords, {
    fields: [opportunityEvidence.sourceRecordId],
    references: [sourceRecords.id],
  }),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  opportunitySkills: many(opportunitySkills),
}));

export const opportunitySkillsRelations = relations(opportunitySkills, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunitySkills.opportunityId],
    references: [opportunities.id],
  }),
  skill: one(skills, {
    fields: [opportunitySkills.skillId],
    references: [skills.id],
  }),
}));

export const leadScoresRelations = relations(leadScores, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [leadScores.opportunityId],
    references: [opportunities.id],
  }),
}));

export const clientLeadsRelations = relations(clientLeads, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [clientLeads.opportunityId],
    references: [opportunities.id],
  }),
  outreachActivities: many(outreachActivities),
}));

export const outreachActivitiesRelations = relations(outreachActivities, ({ one }) => ({
  clientLead: one(clientLeads, {
    fields: [outreachActivities.clientLeadId],
    references: [clientLeads.id],
  }),
}));

export const opportunityFeedbackRelations = relations(opportunityFeedback, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityFeedback.opportunityId],
    references: [opportunities.id],
  }),
}));

export const problemClustersRelations = relations(problemClusters, ({ many }) => ({
  clusterMembers: many(clusterMembers),
  serviceIdeas: many(serviceIdeas),
}));

export const clusterMembersRelations = relations(clusterMembers, ({ one }) => ({
  cluster: one(problemClusters, {
    fields: [clusterMembers.clusterId],
    references: [problemClusters.id],
  }),
  opportunity: one(opportunities, {
    fields: [clusterMembers.opportunityId],
    references: [opportunities.id],
  }),
}));

export const serviceIdeasRelations = relations(serviceIdeas, ({ one }) => ({
  cluster: one(problemClusters, {
    fields: [serviceIdeas.clusterId],
    references: [problemClusters.id],
  }),
}));

export const ingestionRunsRelations = relations(ingestionRuns, ({ one }) => ({
  source: one(sources, {
    fields: [ingestionRuns.sourceId],
    references: [sources.id],
  }),
}));

export const schema = {
  sources,
  sourceRecords,
  opportunities,
  opportunityEvidence,
  skills,
  opportunitySkills,
  leadScores,
  clientLeads,
  outreachActivities,
  opportunityFeedback,
  ingestionRuns,
  problemClusters,
  clusterMembers,
  serviceIdeas,
  sourcesRelations,
  sourceRecordsRelations,
  opportunitiesRelations,
  opportunityEvidenceRelations,
  skillsRelations,
  opportunitySkillsRelations,
  leadScoresRelations,
  clientLeadsRelations,
  outreachActivitiesRelations,
  opportunityFeedbackRelations,
  ingestionRunsRelations,
  problemClustersRelations,
  clusterMembersRelations,
  serviceIdeasRelations,
};
