import { describe, expect, it } from 'vitest';

import type { AiProvider } from './provider.js';
import { MockProvider } from './mock.js';
import {
  buildServiceIdeaPrompt,
  generateServiceIdea,
  SERVICE_IDEA_PROMPT_VERSION,
  SERVICE_IDEA_TASK_MARKER,
  ServiceIdeaValidationError,
  serviceIdeaSchema,
  type ServiceIdeaPromptInput,
} from './service-ideas.js';

const input: ServiceIdeaPromptInput = {
  clusterTitle: 'Teams struggle to reconcile spreadsheets',
  clusterDescription: 'Multiple teams manually merge spreadsheets every week.',
  independentSourceCount: 3,
  memberCount: 12,
  excerpts: [
    'We spend a full day every week copying data between spreadsheets.',
    'The manual reconciliation keeps causing errors.',
  ],
};

const wellFormedIdea = {
  title: 'Spreadsheet reconciliation service',
  summary: 'A service that automates weekly spreadsheet reconciliation.',
  targetCustomer: null,
  suggestedService: 'A hosted reconciliation tool with integrations.',
  requiredSkills: ['TypeScript', 'Node.js'],
  engagementModel: 'FixedProject',
  validationQuestions: ['How often does this happen?', 'What does it cost today?'],
  nextAction: 'Interview three affected operators.',
};

class BadJsonStubProvider implements AiProvider {
  async generateJson(): Promise<string> {
    return '{"bad":true}';
  }

  async generateText(): Promise<string> {
    return '';
  }
}

describe('serviceIdeaSchema', () => {
  it('accepts a well-formed service idea', () => {
    expect(serviceIdeaSchema.safeParse(wellFormedIdea).success).toBe(true);
  });

  it('rejects a requiredSkills that is not an array', () => {
    const parsed = serviceIdeaSchema.safeParse({
      ...wellFormedIdea,
      requiredSkills: 'TypeScript',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a response missing suggestedService', () => {
    const withoutSuggestedService: Record<string, unknown> = { ...wellFormedIdea };
    delete withoutSuggestedService.suggestedService;

    expect(serviceIdeaSchema.safeParse(withoutSuggestedService).success).toBe(false);
  });
});

describe('buildServiceIdeaPrompt', () => {
  it('starts the system prompt with the service idea task marker', () => {
    const { system } = buildServiceIdeaPrompt(input);

    expect(system.startsWith(SERVICE_IDEA_TASK_MARKER)).toBe(true);
    expect(system).toContain(SERVICE_IDEA_TASK_MARKER);
  });

  it('instructs the model not to claim proven demand', () => {
    const { system } = buildServiceIdeaPrompt(input);

    expect(system).toMatch(/do not assert proven market demand/i);
    expect(system).toMatch(/proven/i);
  });

  it('treats the excerpts and cluster text as untrusted data', () => {
    const { system } = buildServiceIdeaPrompt(input);

    expect(system).toMatch(/untrusted/i);
    expect(system).toMatch(/never follow/i);
    expect(system).toMatch(/instructions/i);
  });
});

describe('generateServiceIdea with MockProvider', () => {
  it('returns a schema-valid result and the prompt version', async () => {
    const outcome = await generateServiceIdea(input, new MockProvider());

    expect(serviceIdeaSchema.safeParse(outcome.result).success).toBe(true);
    expect(outcome.result.title.length).toBeGreaterThan(0);
    expect(outcome.result.suggestedService.length).toBeGreaterThan(0);
    expect(Array.isArray(outcome.result.requiredSkills)).toBe(true);
    expect(Array.isArray(outcome.result.validationQuestions)).toBe(true);
    expect(outcome.promptVersion).toBe(SERVICE_IDEA_PROMPT_VERSION);
  });
});

describe('generateServiceIdea validation failures', () => {
  it('throws ServiceIdeaValidationError when the model returns schema-invalid JSON', async () => {
    await expect(generateServiceIdea(input, new BadJsonStubProvider())).rejects.toBeInstanceOf(
      ServiceIdeaValidationError,
    );
  });
});
