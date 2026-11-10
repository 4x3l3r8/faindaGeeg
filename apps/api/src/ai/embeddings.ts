import { env } from '../config/env.js';

export const EMBEDDING_DIM = 256;

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

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(EMBEDDING_DIM).fill(0);

    for (const token of tokenize(text)) {
      const hash = fnv1a(token);
      const index = hash % EMBEDDING_DIM;
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
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
        dimensions: EMBEDDING_DIM,
      }),
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
      if (!Array.isArray(item.embedding) || item.embedding.length !== EMBEDDING_DIM) {
        throw new Error('OpenAI embeddings response contained a mismatched vector');
      }
      return item.embedding;
    });
  }
}

export function getEmbedder(): Embedder {
  if (env.EMBEDDINGS_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAIEmbedder(env.OPENAI_API_KEY);
  }

  return new LocalEmbedder();
}
