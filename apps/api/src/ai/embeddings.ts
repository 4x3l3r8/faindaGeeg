import { env } from '../config/env.js';

export const EMBEDDING_DIM = 256;

function resolveLocalDim(): number {
  return env.EMBEDDING_DIM && env.EMBEDDING_DIM > 0 ? env.EMBEDDING_DIM : EMBEDDING_DIM;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface Embedder {
  name: string;
  readonly dimensions?: number;
  embed(texts: string[]): Promise<number[][]>;
}

function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

export class LocalEmbedder implements Embedder {
  readonly name = 'local';
  readonly dimensions: number;

  constructor(dim: number = resolveLocalDim()) {
    this.dimensions = dim;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const dim = this.dimensions;
    const vector = new Array<number>(dim).fill(0);

    for (const token of tokenize(text)) {
      const hash = fnv1a(token);
      const index = hash % dim;
      const sign = (hash & 0x80000000) !== 0 ? -1 : 1;
      vector[index] = (vector[index] ?? 0) + sign;
    }

    let norm = 0;
    for (const value of vector) {
      norm += value * value;
    }

    if (norm === 0) {
      return vector;
    }

    const magnitude = Math.sqrt(norm);
    return vector.map((value) => value / magnitude);
  }
}

interface OpenAIEmbeddingData {
  embedding: number[];
}

interface OpenAIEmbeddingResponse {
  data?: OpenAIEmbeddingData[];
}

export class OpenAIEmbedder implements Embedder {
  readonly name = 'openai';
  readonly dimensions?: number;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'text-embedding-3-small', dimensions?: number) {
    this.apiKey = apiKey;
    this.model = model;
    if (dimensions !== undefined) {
      this.dimensions = dimensions;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const body: { model: string; input: string[]; dimensions?: number } = {
      model: this.model,
      input: texts,
    };

    if (this.dimensions !== undefined && this.dimensions > 0) {
      body.dimensions = this.dimensions;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
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
        `OpenAI embeddings request failed with status ${response.status}${
          detail ? `: ${detail.slice(0, 500)}` : ''
        }`,
      );
    }

    const payload = (await response.json()) as OpenAIEmbeddingResponse;
    const data = payload.data;

    if (!Array.isArray(data) || data.length !== texts.length) {
      throw new Error('OpenAI embeddings response had an unexpected shape');
    }

    return data.map((item) => {
      if (!Array.isArray(item.embedding)) {
        throw new Error('OpenAI embeddings response contained a malformed vector');
      }
      if (this.dimensions !== undefined && item.embedding.length !== this.dimensions) {
        throw new Error('OpenAI embeddings response contained a mismatched vector');
      }
      return item.embedding;
    });
  }
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isErrorPayload(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export class HuggingFaceEmbedder implements Embedder {
  readonly name = 'huggingface';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly prefix: string | undefined;

  constructor(apiKey: string, model: string, opts?: { prefix?: string | undefined }) {
    this.apiKey = apiKey;
    this.model = model;
    this.prefix = opts?.prefix;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const inputs = this.prefix !== undefined ? texts.map((text) => `${this.prefix}${text}`) : texts;

    const response = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs, options: { wait_for_model: true } }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `HuggingFace embeddings request failed with status ${response.status}${
          detail ? `: ${detail.slice(0, 500)}` : ''
        }`,
      );
    }

    const payload: unknown = await response.json();

    if (isErrorPayload(payload)) {
      throw new Error(
        `HuggingFace embeddings request returned an error: ${String(payload.error)}`,
      );
    }

    if (!isUnknownArray(payload) || payload.length !== texts.length) {
      throw new Error('HuggingFace embeddings response had an unexpected shape');
    }

    return payload.map((entry) => {
      if (!isUnknownArray(entry)) {
        throw new Error('HuggingFace embeddings response had an unexpected shape');
      }
      return entry.map((value) => {
        if (typeof value !== 'number') {
          throw new Error('HuggingFace embeddings response contained a non-numeric vector');
        }
        return value;
      });
    });
  }
}

export function getEmbedder(): Embedder {
  if (env.EMBEDDINGS_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAIEmbedder(
      env.OPENAI_API_KEY,
      env.OPENAI_EMBEDDINGS_MODEL ?? 'text-embedding-3-small',
      env.EMBEDDING_DIM && env.EMBEDDING_DIM > 0 ? env.EMBEDDING_DIM : undefined,
    );
  }

  if (
    (env.EMBEDDINGS_PROVIDER === 'huggingface' || env.EMBEDDINGS_PROVIDER === 'hf') &&
    env.HF_API_KEY
  ) {
    return new HuggingFaceEmbedder(
      env.HF_API_KEY,
      env.HF_EMBEDDINGS_MODEL ?? 'BAAI/bge-small-en-v1.5',
      { prefix: undefined },
    );
  }

  return new LocalEmbedder();
}
