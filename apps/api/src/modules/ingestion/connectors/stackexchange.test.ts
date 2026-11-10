import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({ env: {} }));

import { StackExchangeConnector } from './stackexchange.js';

function stubFetch(payload: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => payload,
      }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StackExchangeConnector.fetch', () => {
  it('maps items to records and advances the page cursor', async () => {
    const fetchMock = stubFetch({
      items: [
        {
          question_id: 123,
          title: 'How to X',
          body: '<p>body &amp; more</p>',
          link: 'https://so/q/123',
          creation_date: 1700000000,
          owner: { display_name: 'alice' },
          score: 5,
          tags: ['typescript'],
        },
      ],
      has_more: true,
    });

    const connector = new StackExchangeConnector();
    const batch = await connector.fetch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(batch.hasMore).toBe(true);
    expect(batch.nextCursor).toEqual({ page: 2 });
    expect(batch.records).toHaveLength(1);

    const record = batch.records[0];
    expect(record?.externalId).toBe('123');
    expect(record?.url).toBe('https://so/q/123');
    expect(record?.content).toContain('How to X');
    expect(record?.content).toContain('body & more');
    expect(record?.content).not.toContain('<p>');
    expect(record?.authorKey).toBe('alice');
    expect(record?.publishedAt).toBeInstanceOf(Date);
  });
});
