import { useQuery } from '@tanstack/react-query';

import { getDbHealth, getHealth } from '@/lib/api';
import { cn } from '@/lib/utils';

type StatusTone = 'ok' | 'degraded' | 'down' | 'loading';

const TONE_STYLES: Record<StatusTone, { badge: string; dot: string; label: string }> = {
  ok: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'API & DB operational',
  },
  degraded: {
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    label: 'API up · DB unavailable',
  },
  down: {
    badge: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'API unreachable',
  },
  loading: {
    badge: 'border-border bg-muted text-muted-foreground',
    dot: 'animate-pulse bg-muted-foreground',
    label: 'Checking API…',
  },
};

export function ApiStatus() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
    refetchInterval: 30_000,
  });

  const dbQuery = useQuery({
    queryKey: ['health', 'db'],
    queryFn: getDbHealth,
    enabled: healthQuery.isSuccess,
    retry: false,
    refetchInterval: 30_000,
  });

  const tone: StatusTone = healthQuery.isPending
    ? 'loading'
    : healthQuery.isError
      ? 'down'
      : dbQuery.data?.database.ok === true
        ? 'ok'
        : 'degraded';

  const style = TONE_STYLES[tone];

  return (
    <span
      title={
        tone === 'ok'
          ? 'Liveness probe and database probe both succeeded.'
          : tone === 'degraded'
            ? 'The API responded but the database probe failed.'
            : tone === 'down'
              ? `Could not reach the API at ${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'}.`
              : 'Contacting the API health endpoints…'
      }
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        style.badge,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}
