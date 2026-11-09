import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOpportunities, useSubmit } from '@/lib/hooks';
import { coerceScore, scoreBand } from '@/lib/score';
import type {
  BuyingIntent,
  ListOpportunitiesParams,
  OpportunityRow,
  OpportunityStatus,
  OpportunityType,
  SubmitInput,
  SubmitResult,
} from '@/lib/types';

const PAGE_SIZE = 20;

const TYPE_OPTIONS: readonly OpportunityType[] = ['gig', 'problem', 'product_gap'];
const INTENT_OPTIONS: readonly BuyingIntent[] = ['explicit', 'implied', 'unknown'];
const STATUS_OPTIONS: readonly OpportunityStatus[] = [
  'new',
  'reviewing',
  'qualified',
  'contacted',
  'replied',
  'discussion',
  'proposal',
  'won',
  'lost',
  'rejected',
  'archived',
];

const TYPE_LABELS: Record<OpportunityType, string> = {
  gig: 'Gig',
  problem: 'Problem',
  product_gap: 'Product gap',
};

const INTENT_LABELS: Record<BuyingIntent, string> = {
  explicit: 'Explicit',
  implied: 'Implied',
  unknown: 'Unknown intent',
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

interface FilterState {
  opportunityType: OpportunityType | 'all';
  status: OpportunityStatus | 'all';
  buyingIntent: BuyingIntent | 'all';
  minScore: string;
  search: string;
}

const INITIAL_FILTERS: FilterState = {
  opportunityType: 'all',
  status: 'all',
  buyingIntent: 'all',
  minScore: '',
  search: '',
};

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function SubmitResultMessage({ result }: { result: SubmitResult }) {
  switch (result.status) {
    case 'created': {
      const band = scoreBand(result.totalScore);
      return (
        <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <span className="font-medium">Created.</span>
          <Link className="underline" to={`/opportunities/${result.opportunityId}`}>
            View opportunity
          </Link>
          <Badge className={band.className}>
            {band.label} · {Math.round(result.totalScore)}
          </Badge>
        </p>
      );
    }
    case 'duplicate':
      return (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">Already seen.</span>
          {result.opportunityId !== null ? (
            <Link className="underline" to={`/opportunities/${result.opportunityId}`}>
              View existing opportunity
            </Link>
          ) : (
            <span>No linked opportunity.</span>
          )}
        </p>
      );
    case 'irrelevant':
      return (
        <p className="text-sm text-muted-foreground">
          Marked irrelevant — no opportunity was created.
        </p>
      );
    case 'needs_review':
      return (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Needs review: {result.reason}
        </p>
      );
  }
}

function OpportunityRowCard({ row }: { row: OpportunityRow }) {
  const score = coerceScore(row.leadScore?.totalScore ?? row.totalScore);
  const band = scoreBand(score);

  return (
    <Link to={`/opportunities/${row.id}`} className="block">
      <Card className="transition-colors hover:bg-accent">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-medium">{row.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{TYPE_LABELS[row.opportunityType]}</Badge>
              <Badge className={band.className}>
                {band.label}
                {score !== null ? ` · ${Math.round(score)}` : ''}
              </Badge>
              <Badge variant="outline">{INTENT_LABELS[row.buyingIntent]}</Badge>
              <Badge variant="muted">{formatLabel(row.status)}</Badge>
            </div>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
          <p className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function OpportunitiesPage() {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const submit = useSubmit();

  const params: ListOpportunitiesParams = { page, pageSize: PAGE_SIZE };
  if (filters.opportunityType !== 'all') params.opportunityType = filters.opportunityType;
  if (filters.status !== 'all') params.status = filters.status;
  if (filters.buyingIntent !== 'all') params.buyingIntent = filters.buyingIntent;
  const minScore = Number(filters.minScore);
  if (filters.minScore !== '' && Number.isFinite(minScore)) params.minScore = minScore;
  const search = filters.search.trim();
  if (search !== '') params.search = search;

  const opportunities = useOpportunities(params);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: SubmitInput = {};
    if (text.trim() !== '') input.text = text.trim();
    if (url.trim() !== '') input.url = url.trim();
    if (input.text === undefined && input.url === undefined) return;

    submit.mutate(input, {
      onSuccess: () => {
        setText('');
        setUrl('');
      },
    });
  }

  const total = opportunities.data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          The signal inbox. Submit raw text or a URL, then triage the scored results.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">New submission</CardTitle>
          <CardDescription>Provide raw opportunity text or a URL — one is enough.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <textarea
              className="min-h-[96px] w-full rounded-md border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              placeholder="Paste the raw post, email, or job description…"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={submit.isPending}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                placeholder="https://…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={submit.isPending}
              />
              <Button
                type="submit"
                disabled={submit.isPending || (text.trim() === '' && url.trim() === '')}
              >
                {submit.isPending ? 'Submitting…' : 'Submit'}
              </Button>
            </div>

            {submit.data ? <SubmitResultMessage result={submit.data} /> : null}
            {submit.error ? (
              <p className="text-sm text-destructive">
                {submit.error instanceof Error ? submit.error.message : 'Submission failed.'}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField
            label="Type"
            value={filters.opportunityType}
            onChange={(value) => updateFilter('opportunityType', value as FilterState['opportunityType'])}
          >
            <option value="all">All types</option>
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={filters.status}
            onChange={(value) => updateFilter('status', value as FilterState['status'])}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Buying intent"
            value={filters.buyingIntent}
            onChange={(value) => updateFilter('buyingIntent', value as FilterState['buyingIntent'])}
          >
            <option value="all">All intents</option>
            {INTENT_OPTIONS.map((intent) => (
              <option key={intent} value={intent}>
                {INTENT_LABELS[intent]}
              </option>
            ))}
          </SelectField>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Min score</span>
            <input
              type="number"
              min={0}
              max={100}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={filters.minScore}
              onChange={(event) => updateFilter('minScore', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Search</span>
            <input
              type="search"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Title or text…"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {opportunities.isPending ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Loading opportunities…
            </CardContent>
          </Card>
        ) : null}

        {opportunities.isError ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-destructive">
              {opportunities.error instanceof Error
                ? opportunities.error.message
                : 'Failed to load opportunities.'}
            </CardContent>
          </Card>
        ) : null}

        {opportunities.data && opportunities.data.data.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No opportunities yet — submit one above
            </CardContent>
          </Card>
        ) : null}

        {opportunities.data?.data.map((row) => (
          <OpportunityRowCard key={row.id} row={row} />
        ))}
      </div>

      {opportunities.data ? (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {opportunities.data.pagination.page} of{' '}
            {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
