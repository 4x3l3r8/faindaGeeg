import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgres://localhost:5432/fainda_geeg_test';
  process.env.EMBEDDINGS_PROVIDER = 'local';
  delete process.env.OPENAI_API_KEY;
});

import { cosineSimilarity, EMBEDDING_DIM, getEmbedder, LocalEmbedder } from './embeddings.js';

function l2Norm(vector: number[]): number {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

describe('LocalEmbedder.embed', () => {
  it('returns one vector of length EMBEDDING_DIM per input text', async () => {
    const embedder = new LocalEmbedder();
    const vectors = await embedder.embed(['React Node developer', 'weekend hiking camping trip']);

    expect(EMBEDDING_DIM).toBe(256);
    expect(vectors).toHaveLength(2);
    for (const vector of vectors) {
      expect(vector).toHaveLength(EMBEDDING_DIM);
    }
  });

  it('is deterministic: the same text yields deep-equal vectors', async () => {
    const embedder = new LocalEmbedder();
    const text = 'React Node developer dashboard';

    const [first] = await embedder.embed([text]);
    const [second] = await embedder.embed([text]);

    expect(first).toEqual(second);
  });

  it('normalizes a text with usable tokens to unit L2 norm', async () => {
    const embedder = new LocalEmbedder();
    const [vector] = await embedder.embed(['React Node developer dashboard']);

    expect(vector).toBeDefined();
    expect(l2Norm(vector ?? [])).toBeCloseTo(1, 6);
  });

  it('leaves the zero vector unnormalized when there are no usable tokens', async () => {
    const embedder = new LocalEmbedder();
    const [vector] = await embedder.embed(['a b c']);

    expect(l2Norm(vector ?? [])).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('returns ~1 for identical non-zero vectors', () => {
    const vector = [0.5, 0.5, 0.5, 0.5];

    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 6);
  });

  it('gives higher similarity to related career texts than unrelated ones', async () => {
    const embedder = new LocalEmbedder();
    const [base] = await embedder.embed(['React Node developer dashboard']);
    const [related] = await embedder.embed(['Node.js React engineer dashboard app']);
    const [unrelated] = await embedder.embed(['weekend hiking camping trip']);

    const relatedScore = cosineSimilarity(base ?? [], related ?? []);
    const unrelatedScore = cosineSimilarity(base ?? [], unrelated ?? []);

    expect(relatedScore).toBeGreaterThan(unrelatedScore);
    expect(relatedScore).toBeGreaterThan(0.2);
  });

  it('returns 0 when either vector is all zeros', () => {
    const zeros = new Array<number>(EMBEDDING_DIM).fill(0);
    const vector = new Array<number>(EMBEDDING_DIM).fill(0).map((_, index) => index + 1);

    expect(cosineSimilarity(zeros, vector)).toBe(0);
    expect(cosineSimilarity(vector, zeros)).toBe(0);
    expect(cosineSimilarity(zeros, zeros)).toBe(0);
  });
});

describe('getEmbedder', () => {
  it('returns a local embedder by default when no OpenAI env is set', () => {
    const embedder = getEmbedder();

    expect(embedder).toBeInstanceOf(LocalEmbedder);
    expect(embedder.name).toBe('local');
  });
});
