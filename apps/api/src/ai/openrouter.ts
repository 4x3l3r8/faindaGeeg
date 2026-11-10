import type { AiProvider, GenerateJsonArgs, GenerateTextArgs } from './provider.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterRequestBody {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  response_format?: { type: 'json_object' };
  temperature: number;
  max_tokens?: number;
}

interface OpenRouterResponseBody {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export class OpenRouterProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateJson(args: GenerateJsonArgs): Promise<string> {
    const body: OpenRouterRequestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    };

    if (args.maxTokens !== undefined) {
      body.max_tokens = args.maxTokens;
    }

    return this.request(body);
  }

  async generateText(args: GenerateTextArgs): Promise<string> {
    const body: OpenRouterRequestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      temperature: 0.4,
    };

    if (args.maxTokens !== undefined) {
      body.max_tokens = args.maxTokens;
    }

    return this.request(body);
  }

  private async request(body: OpenRouterRequestBody): Promise<string> {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `OpenRouter request failed with status ${response.status}${
          detail ? `: ${detail.slice(0, 500)}` : ''
        }`,
      );
    }

    const payload = (await response.json()) as OpenRouterResponseBody;
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('OpenRouter response did not contain message content');
    }

    return content;
  }
}
