import type { ZodIssue } from 'zod';

import { extractionResultSchema, type ExtractionResult } from '../shared/index.js';
import {
  buildExtractionPrompt,
  EXTRACTION_PROMPT_VERSION,
  type ExtractionPromptRecord,
} from './prompts.js';
import type { AiProvider } from './provider.js';

export class ExtractionValidationError extends Error {
  readonly issues: ZodIssue[];
  readonly rawText: string;

  constructor(
    issues: ZodIssue[],
    rawText: string,
    message = 'AI extraction response failed schema validation',
  ) {
    super(message);
    this.name = 'ExtractionValidationError';
    this.issues = issues;
    this.rawText = rawText;
  }
}

export interface ExtractionOutcome {
  result: ExtractionResult;
  promptVersion: string;
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

export async function extractOpportunity(
  record: ExtractionPromptRecord,
  provider: AiProvider,
): Promise<ExtractionOutcome> {
  const { system, user } = buildExtractionPrompt(record);
  const rawText = await provider.generateJson({ system, user });
  const cleaned = stripMarkdownFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ExtractionValidationError([], rawText, 'AI extraction response was not valid JSON');
  }

  const validation = extractionResultSchema.safeParse(parsed);
  if (!validation.success) {
    throw new ExtractionValidationError(validation.error.issues, rawText);
  }

  return {
    result: validation.data,
    promptVersion: EXTRACTION_PROMPT_VERSION,
  };
}
