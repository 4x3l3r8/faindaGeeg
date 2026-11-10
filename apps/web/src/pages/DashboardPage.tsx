import { Link } from 'react-router-dom';

import { ApiStatus } from '@/components/ApiStatus';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard, useDigest } from '@/lib/hooks';
import { scoreBand } from '@/lib/score';
import type { DailyDigest, DashboardSummary, OpportunityType } from '@/lib/types';

const TYPE_LABELS: Record<OpportunityType, string> = {
  gig: 'Gig',
  problem: 'Problem',
  product_gap: 'Product gap',
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="space-y-1 p-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function BreakdownList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.label} className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <Badge variant="secondary">{item.count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const typeItems = data.opportunitiesByType.map((entry) => ({
    label: TYPE_LABELS[entry.type],
    count: entry.count,
  }));

  const statusItems = data.opportunitiesByStatus.map((entry) => ({
    label: formatLabel(entry.status),
    count: entry.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Opportunities" value={data.totals.opportunities} />
        <StatCard label="Leads" value={data.totals.leads} />
        <StatCard label="Skills" value={data.totals.skills} />
        <StatCard label="High priority" value={data.highPriorityCount} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownList
          title="By type"
          description="Opportunities grouped by signal type."
          items={typeItems}
        />
        <BreakdownList
          title="By status"
          description="Opportunities grouped by workflow status."
          items={statusItems}
        />
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Recent opportunities</CardTitle>
          <CardDescription>The newest signals discovered.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {data.recentOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No opportunities yet — submit one on the Opportunities page.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.recentOpportunities.map((item) => {
                const band = scoreBand(item.totalScore);
                return (
                  <li key={item.id}>
                    <Link
                      to={`/opportunities/${item.id}`}
                      className="flex items-center justify-between gap-4 rounded-md border border-border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{TYPE_LABELS[item.opportunityType]}</Badge>
                        <Badge className={band.className}>{band.label}</Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DigestContent({ data }: { data: DailyDigest }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New</p>
          <p className="text-2xl font-semibold tabular-nums">{data.counts.newOpportunities}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            High priority
          </p>
          <p className="text-2xl font-semibold tabular-nums">{data.counts.highPriority}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Follow-ups
          </p>
          <p className="text-2xl font-semibold tabular-nums">{data.counts.followUpsDue}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          New opportunities
        </p>
        {data.newOpportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new opportunities</p>
        ) : (
          <ul className="space-y-2">
            {data.newOpportunities.map((item) => {
              const band = scoreBand(item.totalScore);
              return (
                <li key={item.id}>
                  <Link
                    to={`/opportunities/${item.id}`}
                    className="flex items-center justify-between gap-4 rounded-md border border-border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                    </div>
                    <Badge className={`${band.className} shrink-0`}>{band.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          High priority
        </p>
        {data.highPriority.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high-priority opportunities</p>
        ) : (
          <ul className="space-y-2">
            {data.highPriority.map((item) => {
              const band = scoreBand(item.totalScore);
              return (
                <li key={item.id}>
                  <Link
                    to={`/opportunities/${item.id}`}
                    className="flex items-center justify-between gap-4 rounded-md border border-border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatLabel(item.status)}</p>
                    </div>
                    <Badge className={`${band.className} shrink-0`}>{band.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Follow-ups due
        </p>
        {data.followUpsDue.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due</p>
        ) : (
          <ul className="space-y-2">
            {data.followUpsDue.map((item) => (
              <li key={item.leadId}>
                <Link
                  to="/leads"
                  className="flex items-center justify-between gap-4 rounded-md border border-border p-3 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatLabel(item.status)}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(item.nextActionAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DigestCard() {
  const { data, isPending, isError } = useDigest();

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Today's digest</CardTitle>
        <CardDescription>
          New and high-priority opportunities, plus leads with follow-ups due.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isPending ? <p className="text-sm text-muted-foreground">Loading digest…</p> : null}
        {isError ? <p className="text-sm text-destructive">Failed to load the digest.</p> : null}
        {data ? <DigestContent data={data} /> : null}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isPending, isError, error } = useDashboard();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Newly discovered and high-priority opportunities, qualified leads, and category breakdowns.
          </p>
        </div>
        <ApiStatus />
      </div>

      {isPending ? (
        <Card>
          <CardContent className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
            Loading dashboard…
          </CardContent>
        </Card>
      ) : null}

      {isError ? (
        <Card>
          <CardContent className="flex min-h-[120px] items-center justify-center text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load the dashboard.'}
          </CardContent>
        </Card>
      ) : null}

      {data ? <DashboardContent data={data} /> : null}

      <DigestCard />
    </div>
  );
}
