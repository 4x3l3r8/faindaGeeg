import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({ env: {} }));

import { RssConnector } from './rss.js';

const RSS_FEED = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0">',
  '  <channel>',
  '    <title>Feed A</title>',
  '    <item>',
  '      <title>First &amp; Post</title>',
  '      <link>https://a/post/1</link>',
  '      <description>&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;</description>',
  '      <guid>guid-1</guid>',
  '      <pubDate>Mon, 06 Jan 2026 00:00:00 GMT</pubDate>',
  '    </item>',
  '  </channel>',
  '</rss>',
].join('\n');

const ATOM_FEED = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<feed xmlns="http://www.w3.org/2005/Atom">',
  '  <title>Feed B</title>',
  '  <entry>',
  '    <title>Second Post</title>',
  '    <link rel="alternate" href="https://b/post/2"/>',
  '    <id>atom-id-2</id>',
  '    <summary>Atom summary</summary>',
  '    <updated>2026-01-07T00:00:00Z</updated>',
  '  </entry>',
  '</feed>',
].join('\n');

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    async (input: string) =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => (input.includes('/atom') ? ATOM_FEED : RSS_FEED),
      }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RssConnector.fetch', () => {
  it('parses an RSS 2.0 feed and progresses the feedIndex cursor', async () => {
    const fetchMock = stubFetch();
    const connector = new RssConnector({ feedUrls: ['https://a/feed', 'https://b/atom'] });

    const batch = await connector.fetch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(batch.hasMore).toBe(true);
    expect(batch.nextCursor).toEqual({ feedIndex: 1 });
    expect(batch.records).toHaveLength(1);

    const record = batch.records[0];
    expect(record?.externalId).toBe('guid-1');
    expect(record?.url).toBe('https://a/post/1');
    expect(record?.content).toContain('Hello & welcome');
    expect(record?.content).not.toContain('<');
    expect(record?.publishedAt).toBeInstanceOf(Date);
  });

  it('parses an Atom feed when advanced via nextCursor', async () => {
    const fetchMock = stubFetch();
    const connector = new RssConnector({ feedUrls: ['https://a/feed', 'https://b/atom'] });

    const first = await connector.fetch();
    const batch = await connector.fetch(first.nextCursor);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(batch.hasMore).toBe(false);
    expect(batch.records).toHaveLength(1);

    const record = batch.records[0];
    expect(record?.externalId).toBe('atom-id-2');
    expect(record?.title).toBe('Second Post');
    expect(record?.url).toBe('https://b/post/2');
    expect(record?.content).toContain('Atom summary');
  });
});
