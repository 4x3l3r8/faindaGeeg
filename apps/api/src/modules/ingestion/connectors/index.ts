import type { ISourceConnector } from '../connector.js';
import { GoogleSheetsConnector } from './google-sheets.js';
import { HackerNewsConnector } from './hackernews.js';
import { RedditConnector } from './reddit.js';

const HACKER_NEWS_SOURCE_NAME = 'Hacker News';
const REDDIT_SOURCE_NAME = 'Reddit';
const GOOGLE_SHEETS_SOURCE_NAME = 'Google Sheets';

export function getConnector(sourceName: string): ISourceConnector | null {
  const normalized = sourceName.trim().toLowerCase();

  if (normalized === HACKER_NEWS_SOURCE_NAME.toLowerCase()) {
    return new HackerNewsConnector();
  }

  if (normalized === REDDIT_SOURCE_NAME.toLowerCase()) {
    return new RedditConnector();
  }

  if (normalized === GOOGLE_SHEETS_SOURCE_NAME.toLowerCase()) {
    return new GoogleSheetsConnector();
  }

  return null;
}

export function listConnectorNames(): string[] {
  return [HACKER_NEWS_SOURCE_NAME, REDDIT_SOURCE_NAME, GOOGLE_SHEETS_SOURCE_NAME];
}
