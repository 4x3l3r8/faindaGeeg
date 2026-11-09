export interface GenerateJsonArgs {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface AiProvider {
  generateJson(args: GenerateJsonArgs): Promise<string>;
}

export type AiProviderName = 'openrouter' | 'mock';
