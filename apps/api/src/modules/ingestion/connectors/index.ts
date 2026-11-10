import type { ISourceConnector } from '../connector.js';
import { HackerNewsConnector } from './hackernews.js';
import { RedditConnector } from './reddit.js';

const HACKER_NEWS_SOURCE_NAME = 'Hacker News';
const REDDIT_SOURCE_NAME = 'Reddit';

export function getConnector(sourceName: string): ISourceConnector | null {
  const normalized = sourceName.trim().toLowerCase();

  if (normalized === HACKER_NEWS_SOURCE_NAME.toLowerCase()) {
    return new HackerNewsConnector();
  }

  if (normalized === REDDIT_SOURCE_NAME.toLowerCase()) {
    return new RedditConnector();
  }

  return null;
}

export function listConnectorNames(): string[] {
  return [HACKER_NEWS_SOURCE_NAME, REDDIT_SOURCE_NAME];
}
