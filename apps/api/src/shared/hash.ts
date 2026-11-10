import { createHash } from 'node:crypto';

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function hashContent(content: string): string {
  return createHash('sha256').update(collapseWhitespace(content)).digest('hex');
}
