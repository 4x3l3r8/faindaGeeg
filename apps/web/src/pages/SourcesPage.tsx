import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useConnectors,
  useIngestionRuns,
  useSources,
  useTriggerIngestion,
} from '@/lib/hooks';
import type { IngestionRun, IngestionRunSummary, IngestionStatus, Source } from '@/lib/types';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null): string {
  if (value === null || value === '') return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

const STATUS_VARIANT: Record<IngestionStatus, 'default' | 'secondary' | 'destructive' | 'muted'> = {
  success: 'secondary',
  partial: 'secondary',
  failed: 'destructive',
  running: 'muted',
  pending: 'muted',
};

const STATUS_CLASS: Record<IngestionStatus, string> = {
  success: 'border-transparent bg-emerald-600 text-white',
  partial: 'border-transparent bg-amber-500 text-white',
  failed: '',
  running: '',
  pending: '',
};

function StatusBadge({ status }: { status: IngestionStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={STATUS_CLASS[status]}>
      {formatLabel(status)}
    </Badge>
  );
}

function SourcesCard() {
  const sources = useSources();

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Sources</CardTitle>
        <CardDescription>Configured feeds and their sync health.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {sources.isPending ? (
          <p className="text-sm text-muted-foreground">Loading sources…</p>
        ) : null}

        {sources.isError ? (
          <p className="text-sm text-destructive">{errorMessage(sources.error)}</p>
        ) : null}

        {sources.data && sources.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources yet — run an ingestion below.</p>
        ) : null}

        {sources.data && sources.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {sources.data.map((source: Source) => (
              <li
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{source.name}</span>
                  <Badge variant="outline">{formatLabel(source.sourceType)}</Badge>
                  <Badge variant={source.isEnabled ? 'secondary' : 'muted'}>
                    {source.isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Last sync: {formatDate(source.lastSuccessfulSyncAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RunIngestionCard() {
  const connectors = useConnectors();
  const trigger = useTriggerIngestion();
  const [connector, setConnector] = useState('');
  const [maxRecords, setMaxRecords] = useState('25');

  useEffect(() => {
    if (connector === '' && connectors.data && connectors.data.length > 0) {
      setConnector(connectors.data[0] ?? '');
    }
  }, [connector, connectors.data]);

  const parsedMaxRecords = Number(maxRecords);
  const maxRecordsValid =
    Number.isInteger(parsedMaxRecords) && parsedMaxRecords >= 1 && parsedMaxRecords <= 100;

  function handleRun() {
    if (!maxRecordsValid) return;
    trigger.mutate({
      ...(connector === '' ? {} : { sourceName: connector }),
      maxRecords: parsedMaxRecords,
    });
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Run ingestion</CardTitle>
        <CardDescription>
          Trigger a connector to pull new records. Reddit requires credentials and may error if
          unset; Hacker News works with no configuration.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Connector</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              value={connector}
              onChange={(event) => setConnector(event.target.value)}
              disabled={connectors.isPending || trigger.isPending}
            >
              {connectors.data?.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Max records (1-100)</span>
            <input
              type="number"
              min={1}
              max={100}
              className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              value={maxRecords}
              onChange={(event) => setMaxRecords(event.target.value)}
              disabled={trigger.isPending}
            />
          </label>

          <Button
            onClick={handleRun}
            disabled={trigger.isPending || !maxRecordsValid || connector === ''}
          >
            {trigger.isPending ? 'Running…' : 'Run now'}
          </Button>
        </div>

        {trigger.error ? (
          <p className="mt-3 text-sm text-destructive">{errorMessage(trigger.error)}</p>
        ) : null}

        {trigger.data ? <RunSummaryLine summary={trigger.data} /> : null}
      </CardContent>
    </Card>
  );
}

function RunSummaryLine({ summary }: { summary: IngestionRunSummary }) {
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      <StatusBadge status={summary.status} />{' '}
      {summary.error
        ? summary.error
        : `Fetched ${summary.recordsFetched}, new ${summary.recordsNew}, processed ${summary.recordsProcessed}, created ${summary.opportunitiesCreated}.`}
    </p>
  );
}

function RecentRunsCard() {
  const runs = useIngestionRuns({ limit: 20 });

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Recent runs</CardTitle>
        <CardDescription>The 20 most recent ingestion runs.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {runs.isPending ? (
          <p className="text-sm text-muted-foreground">Loading runs…</p>
        ) : null}

        {runs.isError ? (
          <p className="text-sm text-destructive">{errorMessage(runs.error)}</p>
        ) : null}

        {runs.data && runs.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingestion runs yet.</p>
        ) : null}

        {runs.data && runs.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Fetched</th>
                  <th className="py-2 pr-3 font-medium">New</th>
                  <th className="py-2 pr-3 font-medium">Processed</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 pr-3 font-medium">Started</th>
                  <th className="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((run: IngestionRun) => (
                  <tr key={run.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{run.recordsFetched}</td>
                    <td className="py-2 pr-3 tabular-nums">{run.recordsNew}</td>
                    <td className="py-2 pr-3 tabular-nums">{run.recordsProcessed}</td>
                    <td className="py-2 pr-3 tabular-nums">{run.opportunitiesCreated}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {formatDate(run.startedAt)}
                    </td>
                    <td
                      className="max-w-[240px] truncate py-2 text-muted-foreground"
                      title={run.error ?? undefined}
                    >
                      {run.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SourcesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <p className="text-sm text-muted-foreground">
          Monitor feeds and connectors, trigger ingestion, and review recent runs.
        </p>
      </div>

      <SourcesCard />
      <RunIngestionCard />
      <RecentRunsCard />
    </div>
  );
}
