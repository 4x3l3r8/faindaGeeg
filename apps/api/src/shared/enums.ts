import { z } from 'zod';

export const opportunityTypes = ['gig', 'problem', 'product_gap'] as const;
export type OpportunityType = (typeof opportunityTypes)[number];
export const opportunityTypeSchema = z.enum(opportunityTypes);

export const buyingIntents = ['explicit', 'implied', 'unknown'] as const;
export type BuyingIntent = (typeof buyingIntents)[number];
export const buyingIntentSchema = z.enum(buyingIntents);

export const engagementTypes = ['fixed_project', 'contract', 'retainer', 'unknown'] as const;
export type EngagementType = (typeof engagementTypes)[number];
export const engagementTypeSchema = z.enum(engagementTypes);

export const opportunityStatuses = [
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
] as const;
export type OpportunityStatus = (typeof opportunityStatuses)[number];
export const opportunityStatusSchema = z.enum(opportunityStatuses);

export const sourceTypes = [
  'reddit',
  'x',
  'facebook',
  'instagram',
  'github',
  'job_board',
  'review',
  'manual',
  'other',
] as const;
export type SourceType = (typeof sourceTypes)[number];
export const sourceTypeSchema = z.enum(sourceTypes);

export const evidenceTypes = ['quote', 'summary', 'link', 'other'] as const;
export type EvidenceType = (typeof evidenceTypes)[number];
export const evidenceTypeSchema = z.enum(evidenceTypes);

export const outreachActivityTypes = [
  'note',
  'draft',
  'contact',
  'reply',
  'proposal',
  'status_change',
  'other',
] as const;
export type OutreachActivityType = (typeof outreachActivityTypes)[number];
export const outreachActivityTypeSchema = z.enum(outreachActivityTypes);
