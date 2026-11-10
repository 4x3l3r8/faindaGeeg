import { env } from '../config/env.js';
import { MockProvider } from './mock.js';
import { OpenRouterProvider } from './openrouter.js';
import type { AiProvider } from './provider.js';

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

export function getAiProvider(): AiProvider {
  if (env.AI_PROVIDER !== 'openrouter' || !env.OPENROUTER_API_KEY) {
    return new MockProvider();
  }

  return new OpenRouterProvider(
    env.OPENROUTER_API_KEY,
    env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
  );
}

export { extractOpportunity, ExtractionValidationError } from './extract.js';
export type { ExtractionOutcome } from './extract.js';
export {
  buildServiceIdeaPrompt,
  generateServiceIdea,
  serviceIdeaSchema,
  SERVICE_IDEA_PROMPT_VERSION,
  ServiceIdeaValidationError,
} from './service-ideas.js';
export type {
  ServiceIdeaPrompt,
  ServiceIdeaPromptInput,
  ServiceIdeaResult,
} from './service-ideas.js';
export { buildExtractionPrompt, EXTRACTION_PROMPT_VERSION } from './prompts.js';
export type { ExtractionPrompt, ExtractionPromptRecord } from './prompts.js';
export {
  buildOutreachPrompt,
  generateOutreachDraft,
  OUTREACH_PROMPT_VERSION,
  PROFILE_SUMMARY,
} from './outreach.js';
export type { OutreachDraft, OutreachPrompt, OutreachPromptInput } from './outreach.js';
export type {
  AiProvider,
  AiProviderName,
  GenerateJsonArgs,
  GenerateTextArgs,
} from './provider.js';
export { MockProvider } from './mock.js';
export { OpenRouterProvider } from './openrouter.js';
export { cosineSimilarity, EMBEDDING_DIM, getEmbedder, HuggingFaceEmbedder } from './embeddings.js';
export type { Embedder } from './embeddings.js';
