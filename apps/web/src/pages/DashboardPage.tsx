import { Link } from 'react-router-dom';

import { ApiStatus } from '@/components/ApiStatus';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/lib/hooks';
import { scoreBand } from '@/lib/score';
import type { DashboardSummary, OpportunityType } from '@/lib/types';

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
    </div>
  );
}
