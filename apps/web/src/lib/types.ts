// Shared API types for the faindaGeeg web client.
//
// These mirror the Fastify API's response shapes. Numeric Postgres columns are
// returned as strings by the driver, so several numeric fields are typed as
// `number | string | null` to stay tolerant of the wire representation.

export type OpportunityType = 'gig' | 'problem' | 'product_gap';

export type BuyingIntent = 'explicit' | 'implied' | 'unknown';

export type EngagementType = 'fixed_project' | 'contract' | 'retainer' | 'unknown';

export type OpportunityStatus =
  | 'new'
  | 'reviewing'
  | 'qualified'
  | 'contacted'
  | 'replied'
  | 'discussion'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'rejected'
  | 'archived';

export type EvidenceType = 'quote' | 'summary' | 'link' | 'other';

export type SourceType =
  | 'reddit'
  | 'x'
  | 'facebook'
  | 'instagram'
  | 'github'
  | 'job_board'
  | 'review'
  | 'manual'
  | 'other';

export type IngestionStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';

export type OutreachActivityType =
  | 'note'
  | 'draft'
  | 'contact'
  | 'reply'
  | 'proposal'
  | 'status_change'
  | 'other';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface EvidenceItem {
  id: string;
  excerpt: string;
  evidenceType: EvidenceType;
  sourceRecordUrl: string | null;
  sourceRecordTitle: string | null;
}

export interface SkillMatch {
  skillId: string;
  name: string;
  matchStrength: number | string | null;
  isRequired: boolean;
  evidenceExcerpt: string | null;
}

export interface ScoreFactor {
  score: number;
  reason: string;
}

export interface ScoreExplanation {
  factors: Record<string, ScoreFactor>;
  missingEvidence: string[];
}

export interface LeadScore {
  id?: string;
  opportunityId?: string;
  scoreVersion: string;
  skillFit: number | string;
  buyingIntent: number | string;
  commercialValue: number | string;
  urgency: number | string;
  freshness: number | string;
  credibility: number | string;
  totalScore: number | string;
  explanation: ScoreExplanation;
  scoredAt?: string;
}

// Score fields joined from the latest lead score onto list rows. The join can be
// null when an opportunity has not been scored yet.
export interface OpportunityScoreSummary {
  id?: string;
  scoreVersion?: string | null;
  skillFit?: number | string | null;
  buyingIntent?: number | string | null;
  commercialValue?: number | string | null;
  urgency?: number | string | null;
  freshness?: number | string | null;
  credibility?: number | string | null;
  totalScore?: number | string | null;
  scoredAt?: string | null;
}

export interface OpportunityRow {
  id: string;
  opportunityType: OpportunityType;
  title: string;
  description: string;
  targetCustomer: string | null;
  buyingIntent: BuyingIntent;
  status: OpportunityStatus;
  createdAt: string;
  // Convenience score fields from the latest lead score join, plus the nested
  // join object as returned by the API. All optional and tolerant of strings.
  totalScore?: number | string | null;
  skillFit?: number | string | null;
  commercialValue?: number | string | null;
  freshness?: number | string | null;
  credibility?: number | string | null;
  scoreVersion?: string | null;
  leadScore?: OpportunityScoreSummary | null;
}

export interface OpportunityDetail {
  id: string;
  opportunityType: OpportunityType;
  title: string;
  description: string;
  targetCustomer: string | null;
  buyingIntent: BuyingIntent;
  engagementType: EngagementType;
  budgetMin: number | string | null;
  budgetMax: number | string | null;
  currency: string | null;
  urgency: number | null;
  commercialEvidence: string | null;
  confidence: number | string | null;
  status: OpportunityStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  evidence: EvidenceItem[];
  skills: SkillMatch[];
  leadScore: LeadScore | null;
}

export interface Feedback {
  id: string;
  opportunityId: string;
  isRelevant: boolean | null;
  rating: number | null;
  notes: string | null;
  createdAt: string;
}

export interface LeadOpportunitySummary {
  id: string;
  title: string;
  opportunityType: OpportunityType;
  status: OpportunityStatus;
}

export interface LeadActivity {
  id: string;
  clientLeadId: string;
  activityType: OutreachActivityType;
  content: string | null;
  outcome: string | null;
  occurredAt: string;
}

export interface Lead {
  id: string;
  opportunityId: string;
  status: OpportunityStatus;
  notes: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Present on the list endpoint.
  opportunityTitle?: string;
  opportunityType?: OpportunityType;
  // Present on the detail endpoint.
  opportunity?: LeadOpportunitySummary;
  activities?: LeadActivity[];
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  isEnabled: boolean;
  proficiency: number | null;
}

export interface DashboardSummary {
  totals: {
    opportunities: number;
    leads: number;
    skills: number;
  };
  opportunitiesByType: Array<{ type: OpportunityType; count: number }>;
  opportunitiesByStatus: Array<{ status: OpportunityStatus; count: number }>;
  highPriorityCount: number;
  recentOpportunities: Array<{
    id: string;
    title: string;
    opportunityType: OpportunityType;
    createdAt: string;
    totalScore: number | null;
  }>;
}

export type SubmitResult =
  | { status: 'created'; opportunityId: string; totalScore: number }
  | { status: 'duplicate'; sourceRecordId: string; opportunityId: string | null }
  | { status: 'irrelevant'; sourceRecordId: string }
  | { status: 'needs_review'; sourceRecordId: string; reason: string };

export interface Source {
  id: string;
  name: string;
  sourceType: SourceType;
  isEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  createdAt: string;
}

export interface IngestionRun {
  id: string;
  sourceId: string | null;
  status: IngestionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  recordsFetched: number;
  recordsNew: number;
  recordsProcessed: number;
  opportunitiesCreated: number;
  error: string | null;
  createdAt: string;
}

export interface IngestionRunSummary {
  runId: string;
  status: IngestionStatus;
  recordsFetched: number;
  recordsNew: number;
  recordsProcessed: number;
  opportunitiesCreated: number;
  error: string | null;
}

export interface TriggerIngestionInput {
  sourceName?: string;
  maxRecords?: number;
}

export interface ListIngestionRunsParams {
  sourceId?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface SubmitInput {
  text?: string;
  url?: string;
}

export interface ListOpportunitiesParams {
  page?: number;
  pageSize?: number;
  opportunityType?: OpportunityType;
  status?: OpportunityStatus;
  buyingIntent?: BuyingIntent;
  minScore?: number;
  sourceId?: string;
  search?: string;
}

export interface FeedbackInput {
  isRelevant?: boolean | null;
  rating?: number | null;
  notes?: string | null;
}

export interface CreateLeadInput {
  opportunityId: string;
  status?: OpportunityStatus;
}

export interface LeadPatchInput {
  status?: OpportunityStatus;
  notes?: string | null;
  nextActionAt?: string | null;
}

export interface ActivityInput {
  activityType: OutreachActivityType;
  content?: string | null;
  outcome?: string | null;
}

export interface SkillInput {
  name: string;
  category: string;
  aliases?: string[];
  proficiency?: number | null;
  isEnabled?: boolean;
}

export interface SkillPatchInput {
  isEnabled?: boolean;
  proficiency?: number | null;
  category?: string;
  aliases?: string[];
}
