import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAddActivity, useLead, useLeads, usePatchLead } from '@/lib/hooks';
import type { Lead, LeadActivity, OpportunityStatus, OutreachActivityType } from '@/lib/types';

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

const ACTIVITY_OPTIONS: readonly OutreachActivityType[] = [
  'note',
  'draft',
  'contact',
  'reply',
  'proposal',
  'status_change',
  'other',
];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null): string {
  if (value === null || value === '') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function toDateTimeLocal(value: string | null): string {
  if (value === null || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function leadTitle(lead: Lead): string {
  return lead.opportunityTitle ?? lead.opportunity?.title ?? 'Untitled opportunity';
}

function ActivityItem({ activity }: { activity: LeadActivity }) {
  return (
    <li className="space-y-1 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{formatLabel(activity.activityType)}</Badge>
        <span className="text-xs text-muted-foreground">{formatDate(activity.occurredAt)}</span>
      </div>
      {activity.content !== null && activity.content !== '' ? (
        <p className="whitespace-pre-wrap text-sm">{activity.content}</p>
      ) : null}
      {activity.outcome !== null && activity.outcome !== '' ? (
        <p className="text-sm text-muted-foreground">Outcome: {activity.outcome}</p>
      ) : null}
    </li>
  );
}

function LeadDetailBody({ id, lead }: { id: string; lead: Lead }) {
  const patch = usePatchLead();
  const addActivity = useAddActivity();

  const [notes, setNotes] = useState(lead.notes ?? '');
  const [nextActionAt, setNextActionAt] = useState(toDateTimeLocal(lead.nextActionAt));
  const [activityType, setActivityType] = useState<OutreachActivityType>('note');
  const [content, setContent] = useState('');
  const [outcome, setOutcome] = useState('');

  const activities = lead.activities ?? [];

  function handleStatusChange(status: OpportunityStatus) {
    patch.mutate({ id, patch: { status } });
  }

  function handleSaveNotes() {
    patch.mutate({ id, patch: { notes: notes.trim() === '' ? null : notes } });
  }

  function handleNextActionChange(value: string) {
    setNextActionAt(value);
    patch.mutate({ id, patch: { nextActionAt: value === '' ? null : new Date(value).toISOString() } });
  }

  function handleAddActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (content.trim() === '') return;

    addActivity.mutate(
      {
        id,
        input: {
          activityType,
          content: content.trim(),
          outcome: outcome.trim() === '' ? null : outcome.trim(),
        },
      },
      {
        onSuccess: () => {
          setContent('');
          setOutcome('');
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {leadTitle(lead)}
            <Badge variant="muted">{formatLabel(lead.status)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2">
          <Link
            to={`/opportunities/${lead.opportunityId}`}
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View opportunity →
          </Link>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              value={lead.status}
              onChange={(event) => handleStatusChange(event.target.value as OpportunityStatus)}
              disabled={patch.isPending}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </span>
            <textarea
              className="min-h-[96px] w-full rounded-md border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              placeholder="Context, contacts, next steps…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={patch.isPending}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next action
            </span>
            <input
              type="datetime-local"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              value={nextActionAt}
              onChange={(event) => handleNextActionChange(event.target.value)}
              disabled={patch.isPending}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={handleSaveNotes} disabled={patch.isPending}>
              {patch.isPending ? 'Saving…' : 'Save notes'}
            </Button>
            {patch.error ? (
              <span className="text-sm text-destructive">{errorMessage(patch.error)}</span>
            ) : null}
            {patch.isSuccess ? (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Activities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </ul>
          )}

          <form className="space-y-3 border-t border-border pt-4" onSubmit={handleAddActivity}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Activity type</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  value={activityType}
                  onChange={(event) =>
                    setActivityType(event.target.value as OutreachActivityType)
                  }
                  disabled={addActivity.isPending}
                >
                  {ACTIVITY_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {formatLabel(type)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Outcome (optional)
                </span>
                <input
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  placeholder="e.g. Awaiting reply"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  disabled={addActivity.isPending}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Content</span>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                placeholder="Record the outreach or engagement…"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={addActivity.isPending}
              />
            </label>

            <div>
              <Button type="submit" size="sm" disabled={addActivity.isPending || content.trim() === ''}>
                {addActivity.isPending ? 'Adding…' : 'Add activity'}
              </Button>
            </div>

            {addActivity.error ? (
              <p className="text-sm text-destructive">{errorMessage(addActivity.error)}</p>
            ) : null}
            {addActivity.isSuccess ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Activity added.</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LeadDetail({ id }: { id: string }) {
  const query = useLead(id);

  if (query.isPending) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading lead…
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-destructive">
          {errorMessage(query.error)}
        </CardContent>
      </Card>
    );
  }

  if (query.data === undefined) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          This lead could not be loaded.
        </CardContent>
      </Card>
    );
  }

  return <LeadDetailBody key={query.data.id} id={id} lead={query.data} />;
}

export function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const leads = useLeads(statusFilter === 'all' ? undefined : statusFilter);
  const rows = leads.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads / CRM</h1>
        <p className="text-sm text-muted-foreground">
          Track qualified leads and the relationships around them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status filter</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as OpportunityStatus | 'all')
              }
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          {leads.isPending ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Loading leads…
              </CardContent>
            </Card>
          ) : null}

          {leads.isError ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-destructive">
                {errorMessage(leads.error)}
              </CardContent>
            </Card>
          ) : null}

          {leads.data && rows.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No leads yet — promote an opportunity from its detail page.
              </CardContent>
            </Card>
          ) : null}

          <ul className="space-y-2">
            {rows.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                    selectedId === lead.id ? 'border-primary bg-accent' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-medium">{leadTitle(lead)}</span>
                    <Badge variant="muted">{formatLabel(lead.status)}</Badge>
                  </div>
                  {lead.nextActionAt !== null && lead.nextActionAt !== '' ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Next: {formatDate(lead.nextActionAt)}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {selectedId === null ? (
            <Card>
              <CardContent className="flex min-h-[240px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Select a lead
              </CardContent>
            </Card>
          ) : (
            <LeadDetail id={selectedId} />
          )}
        </div>
      </div>
    </div>
  );
}
