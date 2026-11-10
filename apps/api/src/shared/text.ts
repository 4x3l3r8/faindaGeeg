function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2f;/gi, '/')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function stripHtml(input: string): string {
  // Decode entities FIRST so entity-encoded markup (e.g. feeds that send
  // &lt;p&gt;…&lt;/p&gt;) becomes real tags before we strip. Decode twice to
  // also resolve double-encoded entities (e.g. &amp;nbsp;). Then strip.
  const decoded = decodeEntities(decodeEntities(input));

  const withoutBlocks = decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, ' ');

  return withoutTags.replace(/\s+/g, ' ').trim();
}
