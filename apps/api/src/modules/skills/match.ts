export interface DbSkill {
  id: string;
  name: string;
  aliases: string[];
  proficiency: number | null;
  isEnabled: boolean;
}

export interface ExtractedSkill {
  name: string;
  isRequired: boolean;
  evidenceExcerpt: string | null;
}

export interface SkillMatch {
  skillId: string;
  name: string;
  matchStrength: number;
  isRequired: boolean;
  evidenceExcerpt: string | null;
}

export interface SkillMatchStats {
  requiredMatched: number;
  requiredTotal: number;
  avgStrength: number;
}

export interface MatchSkillsResult {
  matches: SkillMatch[];
  stats: SkillMatchStats;
}

const EXACT_MATCH_STRENGTH = 1;
const ALIAS_MATCH_STRENGTH = 0.8;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function matchSkills(extracted: ExtractedSkill[], dbSkills: DbSkill[]): MatchSkillsResult {
  const exactByName = new Map<string, DbSkill>();
  const byAlias = new Map<string, DbSkill>();

  for (const skill of dbSkills) {
    if (!skill.isEnabled) {
      continue;
    }

    exactByName.set(normalize(skill.name), skill);

    for (const alias of skill.aliases) {
      byAlias.set(normalize(alias), skill);
    }
  }

  const matches: SkillMatch[] = [];

  for (const skill of extracted) {
    const key = normalize(skill.name);
    const exact = exactByName.get(key);

    if (exact !== undefined) {
      matches.push({
        skillId: exact.id,
        name: exact.name,
        matchStrength: EXACT_MATCH_STRENGTH,
        isRequired: skill.isRequired,
        evidenceExcerpt: skill.evidenceExcerpt,
      });
      continue;
    }

    const alias = byAlias.get(key);

    if (alias !== undefined) {
      matches.push({
        skillId: alias.id,
        name: alias.name,
        matchStrength: ALIAS_MATCH_STRENGTH,
        isRequired: skill.isRequired,
        evidenceExcerpt: skill.evidenceExcerpt,
      });
    }
  }

  const requiredExtracted = extracted.filter((skill) => skill.isRequired);

  const requiredTotal = requiredExtracted.length > 0 ? requiredExtracted.length : extracted.length;

  const requiredMatched =
    requiredExtracted.length > 0
      ? matches.filter((match) => match.isRequired).length
      : matches.length;

  const avgStrength =
    matches.length === 0
      ? 0
      : matches.reduce((sum, match) => sum + match.matchStrength, 0) / matches.length;

  return {
    matches,
    stats: {
      requiredMatched,
      requiredTotal,
      avgStrength,
    },
  };
}
