import type { ISourceConnector } from '../connector.js';
import { HackerNewsConnector } from './hackernews.js';

const HACKER_NEWS_SOURCE_NAME = 'Hacker News';

export function getConnector(sourceName: string): ISourceConnector | null {
  if (sourceName.trim().toLowerCase() === HACKER_NEWS_SOURCE_NAME.toLowerCase()) {
    return new HackerNewsConnector();
  }

  return null;
}

export function listConnectorNames(): string[] {
  return [HACKER_NEWS_SOURCE_NAME];
}
