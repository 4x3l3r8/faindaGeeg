import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({ env: {} }));

import { GoogleSheetsConnector } from './google-sheets.js';

const CSV = [
  'externalId,url,title,content,author,publishedAt',
  'a1,http://example.com/a,Title A,"Hello, world with, commas",alice,2026-01-02',
  ',http://example.com/b,Title B,Content B,bob,',
  ',,,,,',
].join('\n');

function stubFetch(csv: string): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => csv,
      }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GoogleSheetsConnector.fetch', () => {
  it('parses CSV rows, preserving quoted commas and skipping empty rows', async () => {
    const fetchMock = stubFetch(CSV);

    const connector = new GoogleSheetsConnector({ csvUrl: 'http://example/test.csv' });
    const batch = await connector.fetch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://example/test.csv', expect.anything());

    expect(batch.hasMore).toBe(false);
    expect(batch.records).toHaveLength(2);

    const first = batch.records.find((item) => item.externalId === 'a1');
    expect(first).toBeDefined();
    expect(first?.content).toBe('Hello, world with, commas');
    expect(first?.url).toBe('http://example.com/a');
    expect(first?.title).toBe('Title A');
    expect(first?.authorKey).toBe('alice');
    expect(first?.publishedAt).toBeInstanceOf(Date);
    expect(first?.publishedAt?.toISOString()).toBe(new Date('2026-01-02').toISOString());

    const fallback = batch.records.find((item) => item.url === 'http://example.com/b');
    expect(fallback).toBeDefined();
    expect(typeof fallback?.externalId).toBe('string');
    expect(fallback?.externalId).not.toBe('');
    expect(fallback?.externalId).toBe('http://example.com/b');
    expect(fallback?.content).toBe('Content B');
    expect(fallback?.publishedAt).toBeUndefined();

    expect(batch.records.every((item) => item.content.length > 0)).toBe(true);
  });
});
