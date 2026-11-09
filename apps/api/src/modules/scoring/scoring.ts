import type { BuyingIntent, OpportunityType } from '../../shared/index.js';

export const SCORE_VERSION = 'v1';

export interface ScoringWeights {
  skillFit: number;
  buyingIntent: number;
  commercialValue: number;
  urgency: number;
  freshness: number;
  credibility: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  buyingIntentScores: Record<BuyingIntent, number>;
  freshnessHalfLifeHours: Record<OpportunityType, number>;
}

export const defaultScoringConfig: ScoringConfig = {
  weights: {
    skillFit: 0.25,
    buyingIntent: 0.25,
    commercialValue: 0.2,
    urgency: 0.1,
    freshness: 0.1,
    credibility: 0.1,
  },
  buyingIntentScores: {
    explicit: 90,
    implied: 55,
    unknown: 20,
  },
  freshnessHalfLifeHours: {
    gig: 72,
    problem: 720,
    product_gap: 720,
  },
};

export interface BudgetInput {
  min: number | null;
  max: number | null;
}

export interface SkillMatch {
  requiredMatched: number;
  requiredTotal: number;
  avgStrength: number;
}

export interface ScoringInput {
  opportunityType: OpportunityType;
  buyingIntent: BuyingIntent;
  urgency: number | null;
  budget: BudgetInput | null;
  commercialEvidence: string | null;
  skillMatch: SkillMatch;
  sourceCredibility: number;
  publishedAt: Date | null;
  now: Date;
  config?: Partial<ScoringConfig>;
}

export interface FactorExplanation {
  score: number;
  reason: string;
}

export interface ScoreExplanation {
  factors: Record<string, FactorExplanation>;
  missingEvidence: string[];
}

export interface ScoreResult {
  skillFit: number;
  buyingIntent: number;
  commercialValue: number;
  urgency: number;
  freshness: number;
  credibility: number;
  totalScore: number;
  scoreVersion: string;
  explanation: ScoreExplanation;
}

const BUYING_INTENT_REASONS: Record<BuyingIntent, string> = {
  explicit: 'Explicit buying intent: the author directly asked to hire or pay for help.',
  implied: 'Implied buying intent: a need was signalled but no direct request to hire was found.',
  unknown: 'Unknown buying intent: no clear signal of intent to purchase was found.',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveConfig(override: Partial<ScoringConfig> | undefined): ScoringConfig {
  if (override === undefined) {
    return defaultScoringConfig;
  }

  return {
    weights: override.weights ?? defaultScoringConfig.weights,
    buyingIntentScores: override.buyingIntentScores ?? defaultScoringConfig.buyingIntentScores,
    freshnessHalfLifeHours:
      override.freshnessHalfLifeHours ?? defaultScoringConfig.freshnessHalfLifeHours,
  };
}

function computeCommercialMagnitude(budget: BudgetInput): number | null {
  const candidates: number[] = [];
  if (budget.min !== null) {
    candidates.push(budget.min);
  }
  if (budget.max !== null) {
    candidates.push(budget.max);
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

function computeCommercialValue(
  input: ScoringInput,
  missingEvidence: string[],
): FactorExplanation {
  const magnitude = input.budget === null ? null : computeCommercialMagnitude(input.budget);

  if (magnitude !== null) {
    let score: number;
    if (magnitude <= 500) {
      score = 30;
    } else if (magnitude <= 2000) {
      score = 55;
    } else if (magnitude <= 10000) {
      score = 75;
    } else {
      score = 90;
    }

    return {
      score,
      reason: `Budget around ${magnitude} maps to a commercial value of ${score}/100.`,
    };
  }

  const hasCommercialEvidence =
    input.commercialEvidence !== null && input.commercialEvidence.trim().length > 0;

  if (hasCommercialEvidence) {
    return {
      score: 50,
      reason: 'Commercial evidence present without a numeric budget; moderate commercial value.',
    };
  }

  missingEvidence.push('budget', 'commercialEvidence');
  return {
    score: 25,
    reason: 'No budget or commercial evidence found; conservative commercial value.',
  };
}

function computeFreshness(input: ScoringInput, config: ScoringConfig, missingEvidence: string[]): FactorExplanation {
  if (input.publishedAt === null) {
    missingEvidence.push('publishedAt');
    return {
      score: 50,
      reason: 'No publication date available; using a neutral freshness score.',
    };
  }

  const ageHours = Math.max(0, (input.now.getTime() - input.publishedAt.getTime()) / 3_600_000);
  const halfLife = config.freshnessHalfLifeHours[input.opportunityType];

  if (halfLife <= 0) {
    return {
      score: ageHours === 0 ? 100 : 0,
      reason: `Published ${ageHours.toFixed(1)}h ago with no configured half-life; treating it as immediately stale.`,
    };
  }

  const score = clamp(100 * Math.pow(2, -ageHours / halfLife), 0, 100);
  return {
    score,
    reason: `Published ${ageHours.toFixed(1)}h ago; using a ${halfLife}h half-life for ${input.opportunityType} opportunities.`,
  };
}

export function scoreOpportunity(input: ScoringInput): ScoreResult {
  const config = resolveConfig(input.config);
  const missingEvidence: string[] = [];

  let skillFit: FactorExplanation;
  if (input.skillMatch.requiredTotal > 0) {
    const ratio = input.skillMatch.requiredMatched / input.skillMatch.requiredTotal;
    const strength = clamp(input.skillMatch.avgStrength, 0, 1);
    skillFit = {
      score: clamp(ratio * strength * 100, 0, 100),
      reason: `Matched ${input.skillMatch.requiredMatched}/${input.skillMatch.requiredTotal} required skills at ${round2(strength * 100)}% strength.`,
    };
  } else {
    missingEvidence.push('skills');
    skillFit = {
      score: 50,
      reason: 'No required skills were listed; using a neutral skill-fit score.',
    };
  }

  const buyingIntent: FactorExplanation = {
    score: clamp(config.buyingIntentScores[input.buyingIntent], 0, 100),
    reason: BUYING_INTENT_REASONS[input.buyingIntent],
  };

  const commercialValue = computeCommercialValue(input, missingEvidence);

  let urgency: FactorExplanation;
  if (input.urgency !== null) {
    urgency = {
      score: clamp(input.urgency, 0, 100),
      reason: `Extracted urgency of ${clamp(input.urgency, 0, 100)}/100.`,
    };
  } else {
    missingEvidence.push('urgency');
    urgency = {
      score: 30,
      reason: 'No urgency signal found; using a conservative default.',
    };
  }

  const freshness = computeFreshness(input, config, missingEvidence);

  const credibility: FactorExplanation = {
    score: clamp(input.sourceCredibility, 0, 100),
    reason: `Source credibility of ${clamp(input.sourceCredibility, 0, 100)}/100.`,
  };

  const roundedSkillFit = round2(clamp(skillFit.score, 0, 100));
  const roundedBuyingIntent = round2(clamp(buyingIntent.score, 0, 100));
  const roundedCommercialValue = round2(clamp(commercialValue.score, 0, 100));
  const roundedUrgency = round2(clamp(urgency.score, 0, 100));
  const roundedFreshness = round2(clamp(freshness.score, 0, 100));
  const roundedCredibility = round2(clamp(credibility.score, 0, 100));

  const factors: Record<string, FactorExplanation> = {
    skillFit: { score: roundedSkillFit, reason: skillFit.reason },
    buyingIntent: { score: roundedBuyingIntent, reason: buyingIntent.reason },
    commercialValue: { score: roundedCommercialValue, reason: commercialValue.reason },
    urgency: { score: roundedUrgency, reason: urgency.reason },
    freshness: { score: roundedFreshness, reason: freshness.reason },
    credibility: { score: roundedCredibility, reason: credibility.reason },
  };

  const weights = config.weights;
  const totalScore = clamp(
    roundedSkillFit * weights.skillFit +
      roundedBuyingIntent * weights.buyingIntent +
      roundedCommercialValue * weights.commercialValue +
      roundedUrgency * weights.urgency +
      roundedFreshness * weights.freshness +
      roundedCredibility * weights.credibility,
    0,
    100,
  );

  return {
    skillFit: roundedSkillFit,
    buyingIntent: roundedBuyingIntent,
    commercialValue: roundedCommercialValue,
    urgency: roundedUrgency,
    freshness: roundedFreshness,
    credibility: roundedCredibility,
    totalScore: round2(totalScore),
    scoreVersion: SCORE_VERSION,
    explanation: {
      factors,
      missingEvidence,
    },
  };
}
