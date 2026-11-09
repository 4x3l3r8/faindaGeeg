import { getDb, getSql } from './client.js';
import { skills } from './schema/index.js';

type SkillSeed = {
  name: string;
  category: string;
  proficiency: number;
  aliases: string[];
};

const skillSeeds: SkillSeed[] = [
  { name: 'TypeScript', category: 'language', proficiency: 5, aliases: ['ts'] },
  { name: 'JavaScript', category: 'language', proficiency: 5, aliases: ['js'] },
  { name: 'React', category: 'frontend', proficiency: 5, aliases: ['react.js', 'reactjs'] },
  { name: 'Next.js', category: 'frontend', proficiency: 5, aliases: ['nextjs', 'next'] },
  { name: 'Node.js', category: 'backend', proficiency: 5, aliases: ['node', 'nodejs'] },
  { name: 'C#', category: 'language', proficiency: 4, aliases: ['csharp', 'c-sharp'] },
  { name: 'ASP.NET', category: 'backend', proficiency: 4, aliases: ['asp.net', 'dotnet', '.net'] },
  {
    name: 'REST API development',
    category: 'backend',
    proficiency: 5,
    aliases: ['rest', 'restful', 'api'],
  },
  { name: 'SQL', category: 'database', proficiency: 5, aliases: ['sql queries'] },
  { name: 'MySQL', category: 'database', proficiency: 4, aliases: ['mysql'] },
  {
    name: 'Microsoft SQL Server',
    category: 'database',
    proficiency: 4,
    aliases: ['mssql', 'sql server', 'sqlserver'],
  },
  { name: 'PostgreSQL', category: 'database', proficiency: 5, aliases: ['postgres', 'pg'] },
  { name: 'MongoDB', category: 'database', proficiency: 4, aliases: ['mongo', 'mongodb'] },
  { name: 'Frontend architecture', category: 'frontend', proficiency: 5, aliases: ['frontend'] },
  { name: 'Backend development', category: 'backend', proficiency: 5, aliases: ['backend'] },
  {
    name: 'API integration',
    category: 'integration',
    proficiency: 5,
    aliases: ['api integration', 'integrations', 'third-party api'],
  },
  {
    name: 'Business application development',
    category: 'business-apps',
    proficiency: 5,
    aliases: ['business apps', 'line of business'],
  },
  { name: 'SaaS application development', category: 'saas', proficiency: 4, aliases: ['saas'] },
  {
    name: 'Database design',
    category: 'database',
    proficiency: 5,
    aliases: ['schema design', 'data modeling'],
  },
  {
    name: 'Performance optimization',
    category: 'performance',
    proficiency: 4,
    aliases: ['perf', 'optimization', 'performance tuning'],
  },
  {
    name: 'Bug fixing & maintenance',
    category: 'maintenance',
    proficiency: 5,
    aliases: ['bug fixing', 'debugging', 'maintenance'],
  },
  {
    name: 'Business process automation',
    category: 'automation',
    proficiency: 5,
    aliases: ['automation', 'workflow automation', 'rpa'],
  },
  {
    name: 'AI application development',
    category: 'ai',
    proficiency: 4,
    aliases: ['ai', 'llm', 'machine learning', 'genai'],
  },
];

async function main(): Promise<void> {
  const db = getDb();

  const inserted = await db
    .insert(skills)
    .values(skillSeeds)
    .onConflictDoNothing({ target: skills.name })
    .returning({ name: skills.name });

  console.log(`Processed ${skillSeeds.length} skills (${inserted.length} newly inserted).`);

  await getSql().end();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Skill seed failed:', error);
    process.exit(1);
  });
