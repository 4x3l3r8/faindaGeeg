import { describe, expect, it } from 'vitest';

import { matchSkills, type DbSkill, type ExtractedSkill } from './match.js';

const reactSkill: DbSkill = {
  id: 'skill-react',
  name: 'React',
  aliases: ['ReactJS', 'React.js'],
  proficiency: null,
  isEnabled: true,
};

const vueSkill: DbSkill = {
  id: 'skill-vue',
  name: 'Vue',
  aliases: ['VueJS'],
  proficiency: null,
  isEnabled: true,
};

const disabledSkill: DbSkill = {
  id: 'skill-disabled',
  name: 'Angular',
  aliases: ['AngularJS'],
  proficiency: null,
  isEnabled: false,
};

function extracted(name: string, isRequired: boolean): ExtractedSkill {
  return { name, isRequired, evidenceExcerpt: null };
}

describe('matchSkills', () => {
  it('matches an exact skill name case-insensitively with strength 1.0', () => {
    const result = matchSkills([extracted('react', true)], [reactSkill]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.skillId).toBe('skill-react');
    expect(result.matches[0]?.matchStrength).toBe(1);
  });

  it('matches an alias with strength 0.8', () => {
    const result = matchSkills([extracted('reactjs', true)], [reactSkill]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.skillId).toBe('skill-react');
    expect(result.matches[0]?.matchStrength).toBe(0.8);
  });

  it('does not match unknown skills', () => {
    const result = matchSkills([extracted('Rust', true)], [reactSkill]);

    expect(result.matches).toHaveLength(0);
  });

  it('never matches disabled skills', () => {
    const result = matchSkills(
      [extracted('Angular', true), extracted('AngularJS', true)],
      [disabledSkill],
    );

    expect(result.matches).toHaveLength(0);
  });

  it('reports requiredMatched/requiredTotal for required skills', () => {
    const result = matchSkills(
      [extracted('React', true), extracted('Vue', true), extracted('Rust', true)],
      [reactSkill, vueSkill],
    );

    expect(result.stats.requiredTotal).toBe(3);
    expect(result.stats.requiredMatched).toBe(2);
    expect(result.stats.avgStrength).toBe(1);
  });

  it('falls back requiredTotal to extracted.length when nothing is required', () => {
    const result = matchSkills(
      [extracted('React', false), extracted('Rust', false)],
      [reactSkill],
    );

    expect(result.stats.requiredTotal).toBe(2);
    expect(result.stats.requiredMatched).toBe(1);
    expect(result.stats.avgStrength).toBe(1);
  });

  it('computes avgStrength as the mean over matches and 0 when none match', () => {
    const mixed = matchSkills(
      [extracted('React', true), extracted('ReactJS', true)],
      [reactSkill],
    );

    expect(mixed.matches).toHaveLength(2);
    expect(mixed.stats.avgStrength).toBeCloseTo(0.9, 10);

    const none = matchSkills([extracted('Rust', true)], [reactSkill]);

    expect(none.stats.avgStrength).toBe(0);
  });
});
