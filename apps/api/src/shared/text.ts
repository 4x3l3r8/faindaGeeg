export function stripHtml(input: string): string {
  const withoutBlocks = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, ' ');

  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2f;/gi, '/')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  return decoded.replace(/\s+/g, ' ').trim();
}
