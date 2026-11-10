import { afterEach, describe, expect, it, vi } from 'vitest';

import { HackerNewsConnector } from './hackernews.js';

function makeResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response;
}

function stubFetch(body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => makeResponse(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const ALGOLIA_BODY = {
  hits: [
    {
      objectID: '1',
      comment_text: 'Looking for a <b>React</b> dev &amp; Node',
      author: 'alice',
      created_at: '2026-01-01T00:00:00.000Z',
      story_title: 'Ask HN: freelancer',
      story_id: 10,
    },
  ],
  nbPages: 2,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HackerNewsConnector.fetch', () => {
  it('normalizes Algolia hits into raw source records', async () => {
    stubFetch(ALGOLIA_BODY);

    const connector = new HackerNewsConnector();
    const batch = await connector.fetch();

    expect(batch.records).toHaveLength(1);

    const record = batch.records[0];
    expect(record).toBeDefined();
    expect(record?.externalId).toBe('1');
    expect(record?.url).toContain('item?id=1');
    expect(record?.content).toBe('Looking for a React dev & Node');
    expect(record?.content).not.toContain('<b>');
    expect(record?.content).not.toContain('&amp;');
    expect(record?.authorKey).toBe('alice');
    expect(record?.publishedAt).toBeInstanceOf(Date);
    expect(record?.publishedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(record?.title).toBe('Ask HN: freelancer');
  });

  it('advances the cursor to the next page when more pages exist', async () => {
    const fetchMock = stubFetch(ALGOLIA_BODY);

    const connector = new HackerNewsConnector();
    const batch = await connector.fetch({ query: 'freelance developer', page: 0 });

    expect(batch.hasMore).toBe(true);
    expect(batch.nextCursor).toEqual({ query: 'freelance developer', page: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the search response is not ok', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({}),
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const connector = new HackerNewsConnector();

    await expect(connector.fetch()).rejects.toThrow(/503/);
  });
});
