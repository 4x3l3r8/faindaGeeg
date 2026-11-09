import { z } from 'zod';

import { buyingIntentSchema, engagementTypeSchema, evidenceTypeSchema } from './enums.js';

export const classificationSchema = z.enum(['gig', 'problem', 'product_gap', 'irrelevant']);
export type Classification = z.infer<typeof classificationSchema>;

export const requiredSkillSchema = z.object({
  name: z.string().min(1),
  isRequired: z.boolean(),
  evidenceExcerpt: z.string().nullable(),
});
export type RequiredSkill = z.infer<typeof requiredSkillSchema>;

export const budgetSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  currency: z.string().nullable(),
});
export type Budget = z.infer<typeof budgetSchema>;

export const evidenceExcerptSchema = z.object({
  excerpt: z.string().min(1),
  type: evidenceTypeSchema,
  note: z.string().nullable(),
});
export type EvidenceExcerpt = z.infer<typeof evidenceExcerptSchema>;

export const extractionResultSchema = z.object({
  classification: classificationSchema,
  isRelevant: z.boolean(),
  title: z.string().min(1),
  problemSummary: z.string(),
  targetCustomer: z.string().nullable(),
  requiredSkills: z.array(requiredSkillSchema).default([]),
  buyingIntent: buyingIntentSchema,
  urgency: z.number().int().min(0).max(100).nullable(),
  engagementType: engagementTypeSchema,
  budget: budgetSchema.nullable(),
  commercialEvidence: z.string().nullable(),
  currentWorkaround: z.string().nullable(),
  evidenceExcerpts: z.array(evidenceExcerptSchema).default([]),
  suggestedNextAction: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  inferredFields: z.array(z.string()).default([]),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
