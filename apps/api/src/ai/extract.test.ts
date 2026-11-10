import { describe, expect, it } from 'vitest';

import { extractionResultSchema } from '../shared/index.js';
import type { ExtractionPromptRecord } from './prompts.js';
import type { AiProvider } from './provider.js';
import { ExtractionValidationError, extractOpportunity } from './extract.js';
import { MockProvider } from './mock.js';

const wellFormedResult = {
  classification: 'gig',
  isRelevant: true,
  title: 'Need a React developer',
  problemSummary: 'The team needs help building a dashboard.',
  targetCustomer: null,
  requiredSkills: [{ name: 'React', isRequired: true, evidenceExcerpt: null }],
  buyingIntent: 'explicit',
  urgency: 60,
  engagementType: 'fixed_project',
  budget: { min: 1000, max: 5000, currency: 'USD' },
  commercialEvidence: 'Budget stated.',
  currentWorkaround: null,
  evidenceExcerpts: [{ excerpt: 'We want to hire a developer.', type: 'quote', note: null }],
  suggestedNextAction: null,
  confidence: 0.8,
  inferredFields: [],
};

class StubProvider implements AiProvider {
  constructor(private readonly response: string) {}

  async generateJson(): Promise<string> {
    return this.response;
  }

  async generateText(): Promise<string> {
    return this.response;
  }
}

describe('extractionResultSchema', () => {
  it('accepts a well-formed extraction result', () => {
    const parsed = extractionResultSchema.safeParse(wellFormedResult);

    expect(parsed.success).toBe(true);
  });

  it('rejects a bad classification enum value', () => {
    const parsed = extractionResultSchema.safeParse({
      ...wellFormedResult,
      classification: 'bogus',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const withoutTitle: Record<string, unknown> = { ...wellFormedResult };
    delete withoutTitle.title;
    const parsed = extractionResultSchema.safeParse(withoutTitle);

    expect(parsed.success).toBe(false);
  });
});

describe('extractOpportunity with MockProvider', () => {
  it('classifies hiring-style text as an explicit gig', async () => {
    const record: ExtractionPromptRecord = {
      title: 'Hiring a developer',
      content: 'We want to hire a React developer for a new dashboard project.',
    };

    const outcome = await extractOpportunity(record, new MockProvider());

    expect(extractionResultSchema.safeParse(outcome.result).success).toBe(true);
    expect(outcome.result.classification).toBe('gig');
    expect(outcome.result.buyingIntent).toBe('explicit');
  });

  it('classifies irrelevant text as irrelevant and not relevant', async () => {
    const record: ExtractionPromptRecord = {
      title: 'Weather',
      content: 'The weather is nice today and the sky is blue.',
    };

    const outcome = await extractOpportunity(record, new MockProvider());

    expect(outcome.result.classification).toBe('irrelevant');
    expect(outcome.result.isRelevant).toBe(false);
  });
});

describe('extractOpportunity validation failures', () => {
  const record: ExtractionPromptRecord = { content: 'anything' };

  it('throws when the provider returns non-JSON text', async () => {
    await expect(extractOpportunity(record, new StubProvider('not json'))).rejects.toBeInstanceOf(
      ExtractionValidationError,
    );
  });

  it('throws when the provider returns a schema-invalid classification', async () => {
    await expect(
      extractOpportunity(record, new StubProvider('{"classification":"bogus"}')),
    ).rejects.toBeInstanceOf(ExtractionValidationError);
  });
});
