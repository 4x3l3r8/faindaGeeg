import { describe, expect, it } from 'vitest';

import type { AiProvider } from './provider.js';
import {
  buildOutreachPrompt,
  generateOutreachDraft,
  OUTREACH_PROMPT_VERSION,
  PROFILE_SUMMARY,
  type OutreachPromptInput,
} from './outreach.js';
import { MockProvider } from './mock.js';

const input: OutreachPromptInput = {
  title: 'Build a React dashboard for our logistics team',
  description: 'We need help turning a messy spreadsheet into a web dashboard.',
  opportunityType: 'gig',
  targetCustomer: 'A mid-size logistics company',
  buyingIntent: 'explicit',
  matchedSkills: ['React', 'TypeScript'],
};

class TrimmingStubProvider implements AiProvider {
  async generateText(): Promise<string> {
    return '  DRAFT_TEXT  ';
  }

  async generateJson(): Promise<string> {
    throw new Error('generateJson must not be used by the outreach generator');
  }
}

describe('buildOutreachPrompt', () => {
  it('returns system and user strings', () => {
    const prompt = buildOutreachPrompt(input);

    expect(typeof prompt.system).toBe('string');
    expect(typeof prompt.user).toBe('string');
    expect(prompt.system.length).toBeGreaterThan(0);
    expect(prompt.user.length).toBeGreaterThan(0);
  });

  it('treats the opportunity text as untrusted and forbids following embedded instructions', () => {
    const { system } = buildOutreachPrompt(input);

    expect(system).toMatch(/untrusted/i);
    expect(system).toMatch(/never follow/i);
    expect(system).toMatch(/instructions/i);
  });

  it('tells the model not to invent recipient, company, budget, or links', () => {
    const { system } = buildOutreachPrompt(input);

    expect(system).toMatch(/do not invent/i);
    expect(system).toMatch(/recipient/i);
    expect(system).toMatch(/company/i);
    expect(system).toMatch(/budget/i);
    expect(system).toMatch(/links/i);
  });

  it('includes the profile summary and opportunity title in the user message', () => {
    const { user } = buildOutreachPrompt(input);

    expect(user).toContain(PROFILE_SUMMARY);
    expect(user).toContain(input.title);
  });
});

describe('generateOutreachDraft with MockProvider', () => {
  it('returns a non-empty draft with the name placeholder and prompt version', async () => {
    const result = await generateOutreachDraft(input, new MockProvider());

    expect(result.draft.length).toBeGreaterThan(0);
    expect(result.draft).toContain('[your name]');
    expect(result.promptVersion).toBe(OUTREACH_PROMPT_VERSION);
    expect(result.promptVersion).toBe('v1');
  });

  it('does not fabricate contact details or links', async () => {
    const { draft } = await generateOutreachDraft(input, new MockProvider());

    expect(draft).not.toMatch(/\S+@\S+/);
    expect(draft).not.toContain('http');
  });
});

describe('generateOutreachDraft with a stub provider', () => {
  it('uses generateText and trims the returned draft', async () => {
    const result = await generateOutreachDraft(input, new TrimmingStubProvider());

    expect(result.draft).toBe('DRAFT_TEXT');
    expect(result.promptVersion).toBe(OUTREACH_PROMPT_VERSION);
  });
});
