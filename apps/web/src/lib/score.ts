// Maps a numeric lead score onto a presentation band. `null` (or a
// non-numeric value) renders as "Unscored" so callers can pass the raw,
// string-tolerant score fields straight from the API.

export interface ScoreBand {
  label: string;
  className: string;
}

export function scoreBand(score: number | null): ScoreBand {
  if (score === null || Number.isNaN(score)) {
    return { label: 'Unscored', className: 'border-border bg-muted text-muted-foreground' };
  }

  if (score >= 80) {
    return {
      label: 'High',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
  }

  if (score >= 65) {
    return {
      label: 'Promising',
      className: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    };
  }

  if (score >= 45) {
    return {
      label: 'Potential',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  }

  return { label: 'Low', className: 'border-border bg-muted text-muted-foreground' };
}

/**
 * Coerces the API's string-tolerant score fields into a `number | null` that
 * `scoreBand` accepts. Postgres numerics arrive as strings on the wire.
 */
export function coerceScore(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
