import type { ExtractionResult } from '../shared/index.js';
import type { AiProvider, GenerateJsonArgs } from './provider.js';

const GIG_PATTERN = /hire|looking for a developer|freelanc/i;
const PROBLEM_PATTERN = /bug|slow|manual|spreadsheet/i;

const SKILL_KEYWORDS: ReadonlyArray<readonly [readonly string[], string]> = [
  [['react'], 'React'],
  [['next.js', 'nextjs'], 'Next.js'],
  [['node'], 'Node.js'],
  [['typescript', ' ts '], 'TypeScript'],
  [['api', 'integration'], 'API integration'],
  [['rest'], 'REST API development'],
  [['postgres', 'postgresql'], 'PostgreSQL'],
  [['mysql'], 'MySQL'],
  [['sql server', 'mssql'], 'Microsoft SQL Server'],
  [['mongo'], 'MongoDB'],
  [['c#', 'asp.net', '.net'], 'ASP.NET'],
  [['automat', 'spreadsheet', 'manual'], 'Business process automation'],
  [['ai', 'llm', 'machine learning'], 'AI application development'],
  [['dashboard', 'web app', 'frontend'], 'Frontend architecture'],
];

function extractRequiredSkills(haystack: string): ExtractionResult['requiredSkills'] {
  const matched: string[] = [];
  for (const [needles, name] of SKILL_KEYWORDS) {
    if (needles.some((needle) => haystack.includes(needle)) && !matched.includes(name)) {
      matched.push(name);
    }
  }
  return matched.map((name) => ({ name, isRequired: true, evidenceExcerpt: null }));
}

function extractRecord(user: string): { title: string; content: string } {
  const match = /<<<RECORD\s*([\s\S]*?)\s*RECORD>>>/.exec(user);
  let body = (match?.[1] ?? user).trim();
  if (body.length === 0) {
    body = user.trim();
  }

  let title = '';
  const titleMatch = /^Title:\s*(.*)$/m.exec(body);
  if (titleMatch) {
    title = (titleMatch[1] ?? '').trim();
    body = body.replace(/^Title:\s*.*$/m, '');
  }
  body = body.replace(/^\s*Content:\s*$/m, '');

  return { title, content: body.replace(/\s+/g, ' ').trim() };
}

function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(?:\s|$)/.exec(text);
  return match ? (match[1] ?? '').trim() : '';
}

function firstExcerpt(text: string): string {
  const condensed = text.replace(/\s+/g, ' ').trim();
  if (condensed.length === 0) {
    return 'No content provided.';
  }
  return condensed.slice(0, 160);
}

export class MockProvider implements AiProvider {
  async generateJson(args: GenerateJsonArgs): Promise<string> {
    const { title: parsedTitle, content } = extractRecord(args.user);
    const haystack = `${parsedTitle} ${content}`.toLowerCase();

    let classification: ExtractionResult['classification'];
    let buyingIntent: ExtractionResult['buyingIntent'];

    if (GIG_PATTERN.test(haystack)) {
      classification = 'gig';
      buyingIntent = 'explicit';
    } else if (PROBLEM_PATTERN.test(haystack)) {
      classification = 'problem';
      buyingIntent = 'unknown';
    } else {
      classification = 'irrelevant';
      buyingIntent = 'unknown';
    }

    const excerpt = firstExcerpt(content);
    const title = (
      parsedTitle.length > 0
        ? parsedTitle
        : firstSentence(content).length > 0
          ? firstSentence(content)
          : content.slice(0, 80)
    ).slice(0, 100);
    const finalTitle = title.length > 0 ? title : 'Untitled opportunity';

    const result: ExtractionResult = {
      classification,
      isRelevant: classification !== 'irrelevant',
      title: finalTitle,
      problemSummary: classification === 'irrelevant' ? '' : content.slice(0, 240),
      targetCustomer: null,
      requiredSkills: extractRequiredSkills(haystack),
      buyingIntent,
      urgency: null,
      engagementType: 'unknown',
      budget: null,
      commercialEvidence: null,
      currentWorkaround: null,
      evidenceExcerpts: [{ excerpt, type: 'quote', note: null }],
      suggestedNextAction: null,
      confidence: 0.5,
      inferredFields: [],
    };

    return JSON.stringify(result);
  }
}
