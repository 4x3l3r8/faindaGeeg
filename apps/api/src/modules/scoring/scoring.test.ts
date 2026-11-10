import { describe, expect, it } from 'vitest';

import {
  SCORE_VERSION,
  scoreOpportunity,
  type ScoringInput,
} from './scoring.js';

const NOW = new Date('2026-01-15T12:00:00.000Z');

const strongGig: ScoringInput = {
  opportunityType: 'gig',
  buyingIntent: 'explicit',
  urgency: 90,
  budget: { min: 10_000, max: 20_000 },
  commercialEvidence: 'Budget confirmed in thread.',
  skillMatch: { requiredMatched: 3, requiredTotal: 3, avgStrength: 1 },
  sourceCredibility: 90,
  publishedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
  now: NOW,
};

const weakInput: ScoringInput = {
  opportunityType: 'gig',
  buyingIntent: 'unknown',
  urgency: null,
  budget: null,
  commercialEvidence: null,
  skillMatch: { requiredMatched: 0, requiredTotal: 0, avgStrength: 0 },
  sourceCredibility: 0,
  publishedAt: null,
  now: NOW,
};

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.round(value * 100) / 100 === value;
}

describe('scoreOpportunity', () => {
  it('scores a strong gig highly with no missing evidence', () => {
    const result = scoreOpportunity(strongGig);

    expect(result.totalScore).toBeGreaterThanOrEqual(80);
    expect(result.explanation.missingEvidence).toEqual([]);
  });

  it('scores a weak input low and reports missing evidence', () => {
    const result = scoreOpportunity(weakInput);

    expect(result.totalScore).toBeLessThan(50);
    expect(result.explanation.missingEvidence).toContain('skills');
    expect(result.explanation.missingEvidence).toContain('budget');
    expect(result.explanation.missingEvidence).toContain('commercialEvidence');
    expect(result.explanation.missingEvidence).toContain('urgency');
    expect(result.explanation.missingEvidence).toContain('publishedAt');
  });

  it('is deterministic for identical inputs and the same now', () => {
    const first = scoreOpportunity(strongGig);
    const second = scoreOpportunity(strongGig);

    expect(second).toEqual(first);
  });

  it('keeps all factors and totalScore within 0..100 and rounded to <= 2 decimals', () => {
    const result = scoreOpportunity(strongGig);

    const numericValues = [
      result.skillFit,
      result.buyingIntent,
      result.commercialValue,
      result.urgency,
      result.freshness,
      result.credibility,
      result.totalScore,
      ...Object.values(result.explanation.factors).map((factor) => factor.score),
    ];

    for (const value of numericValues) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
      expect(hasAtMostTwoDecimals(value)).toBe(true);
    }
  });

  it('gives ~50 freshness for a gig published exactly one half-life (72h) ago', () => {
    const result = scoreOpportunity({
      ...strongGig,
      opportunityType: 'gig',
      publishedAt: new Date(NOW.getTime() - 72 * 60 * 60 * 1000),
    });

    expect(result.freshness).toBeGreaterThan(50 - 0.5);
    expect(result.freshness).toBeLessThan(50 + 0.5);
  });

  it('exposes the exported score version', () => {
    const result = scoreOpportunity(strongGig);

    expect(result.scoreVersion).toBe(SCORE_VERSION);
  });
});
