import type { ISourceConnector } from '../connector.js';
import { GoogleSheetsConnector } from './google-sheets.js';
import { HackerNewsConnector } from './hackernews.js';
import { RedditConnector } from './reddit.js';
import { RemotiveConnector } from './remotive.js';
import { StackExchangeConnector } from './stackexchange.js';

const HACKER_NEWS_SOURCE_NAME = 'Hacker News';
const REDDIT_SOURCE_NAME = 'Reddit';
const GOOGLE_SHEETS_SOURCE_NAME = 'Google Sheets';
const STACK_EXCHANGE_SOURCE_NAME = 'Stack Exchange';
const REMOTIVE_SOURCE_NAME = 'Remotive';

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

  if (normalized === STACK_EXCHANGE_SOURCE_NAME.toLowerCase()) {
    return new StackExchangeConnector();
  }

  if (normalized === REMOTIVE_SOURCE_NAME.toLowerCase()) {
    return new RemotiveConnector();
  }

  return null;
}

export function listConnectorNames(): string[] {
  return [
    HACKER_NEWS_SOURCE_NAME,
    REDDIT_SOURCE_NAME,
    GOOGLE_SHEETS_SOURCE_NAME,
    STACK_EXCHANGE_SOURCE_NAME,
    REMOTIVE_SOURCE_NAME,
  ];
}
