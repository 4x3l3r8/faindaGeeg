import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({ env: {} }));

import { RemotiveConnector } from './remotive.js';

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

describe('RemotiveConnector.fetch', () => {
  it('maps jobs to records with hasMore false', async () => {
    const fetchMock = stubFetch({
      jobs: [
        {
          id: 42,
          url: 'https://r/42',
          title: 'Senior Dev',
          company_name: 'Acme',
          description: '<p>Build &amp; ship</p>',
          publication_date: '2026-01-01T00:00:00',
          job_type: 'contract',
          candidate_required_location: 'Worldwide',
          tags: ['react'],
        },
      ],
    });

    const connector = new RemotiveConnector();
    const batch = await connector.fetch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(batch.hasMore).toBe(false);
    expect(batch.records).toHaveLength(1);

    const record = batch.records[0];
    expect(record?.externalId).toBe('42');
    expect(record?.url).toBe('https://r/42');
    expect(record?.title).toBe('Senior Dev');
    expect(record?.authorKey).toBe('Acme');
    expect(record?.content).toContain('Senior Dev');
    expect(record?.content).toContain('Acme');
    expect(record?.content).toContain('Build & ship');
    expect(record?.content).not.toMatch(/<[^>]*>/);
    expect(record?.publishedAt).toBeInstanceOf(Date);
  });
});
