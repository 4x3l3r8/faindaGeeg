import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useCreateLead,
  useGenerateDraft,
  useOpportunity,
  useSendFeedback,
  useSetOpportunityStatus,
} from '@/lib/hooks';
import { coerceScore, scoreBand } from '@/lib/score';
import type {
  BuyingIntent,
  EvidenceItem,
  LeadScore,
  OpportunityDetail,
  OpportunityStatus,
  OpportunityType,
  ScoreFactor,
  SkillMatch,
} from '@/lib/types';

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
  explicit: 'Explicit intent',
  implied: 'Implied intent',
  unknown: 'Unknown intent',
};

const FACTOR_ORDER: readonly string[] = [
  'skillFit',
  'buyingIntent',
  'commercialValue',
  'urgency',
  'freshness',
  'credibility',
];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function formatBudget(
  min: number | string | null,
  max: number | string | null,
  currency: string | null,
): string {
  const minValue = coerceScore(min);
  const maxValue = coerceScore(max);

  if (minValue === null && maxValue === null) {
    return 'Unknown';
  }

  const range =
    minValue !== null && maxValue !== null
      ? `${minValue} – ${maxValue}`
      : String(minValue ?? maxValue);

  return currency !== null && currency !== '' ? `${currency} ${range}` : range;
}

function formatMatchStrength(value: number | string | null): string {
  const strength = coerceScore(value);
  return strength === null ? '—' : strength.toFixed(2);
}

function factorEntries(factors: Record<string, ScoreFactor>): Array<[string, ScoreFactor]> {
  const entries: Array<[string, ScoreFactor]> = [];
  for (const key of FACTOR_ORDER) {
    const factor = factors[key];
    if (factor !== undefined) {
      entries.push([key, factor]);
    }
  }
  for (const [key, factor] of Object.entries(factors)) {
    if (!FACTOR_ORDER.includes(key)) {
      entries.push([key, factor]);
    }
  }
  return entries;
}

function DetailState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link
          to="/opportunities"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to opportunities
        </Link>
      </CardContent>
    </Card>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <dt className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function OverviewCard({ opportunity }: { opportunity: OpportunityDetail }) {
  const urgency = coerceScore(opportunity.urgency);
  const confidence = coerceScore(opportunity.confidence);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <p className="mb-4 whitespace-pre-wrap text-sm">{opportunity.description}</p>
        <dl className="space-y-3">
          <OverviewRow label="Target customer" value={opportunity.targetCustomer ?? 'Unknown'} />
          <OverviewRow
            label="Budget"
            value={formatBudget(opportunity.budgetMin, opportunity.budgetMax, opportunity.currency)}
          />
          <OverviewRow label="Urgency" value={urgency === null ? 'Unknown' : String(urgency)} />
          <OverviewRow
            label="Confidence"
            value={confidence === null ? 'Unknown' : String(confidence)}
          />
          <OverviewRow
            label="Commercial evidence"
            value={
              opportunity.commercialEvidence !== null && opportunity.commercialEvidence !== ''
                ? opportunity.commercialEvidence
                : 'None stated'
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function ScoreBreakdownCard({ leadScore }: { leadScore: LeadScore | null }) {
  if (leadScore === null) {
    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Score breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <p className="text-sm text-muted-foreground">Not scored</p>
        </CardContent>
      </Card>
    );
  }

  const total = coerceScore(leadScore.totalScore);
  const entries = factorEntries(leadScore.explanation.factors);
  const missing = leadScore.explanation.missingEvidence;

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Score breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Total score </span>
          <span className="font-semibold tabular-nums">
            {total === null ? '—' : Math.round(total)}
          </span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Factor</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, factor]) => (
                <tr key={key} className="border-b border-border align-top last:border-0">
                  <td className="py-2 pr-3 font-medium">{formatLabel(key)}</td>
                  <td className="py-2 pr-3 tabular-nums">{factor.score}</td>
                  <td className="py-2 text-muted-foreground">{factor.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {missing.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Missing evidence
            </p>
            <div className="flex flex-wrap gap-2">
              {missing.map((item) => (
                <Badge key={item} variant="muted">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SkillsCard({ skills }: { skills: SkillMatch[] }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Matched skills</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matched skills.</p>
        ) : (
          <ul className="space-y-2">
            {skills.map((skill) => (
              <li
                key={skill.skillId}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{skill.name}</span>
                  {skill.isRequired ? <Badge variant="secondary">Required</Badge> : null}
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  Match {formatMatchStrength(skill.matchStrength)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (evidence.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Evidence trail</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <p className="text-sm text-muted-foreground">No evidence recorded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Evidence trail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-2">
        {evidence.map((item) => (
          <div key={item.id} className="space-y-2">
            <blockquote className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
              {item.excerpt}
            </blockquote>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatLabel(item.evidenceType)}</Badge>
              {item.sourceRecordUrl !== null && item.sourceRecordUrl !== '' ? (
                <a
                  href={item.sourceRecordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {item.sourceRecordTitle ?? item.sourceRecordUrl}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {item.sourceRecordTitle ?? 'Manual submission'}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OutreachDraftCard({ opportunityId }: { opportunityId: string }) {
  const draftMutation = useGenerateDraft();
  const [draftText, setDraftText] = useState('');
  const [copied, setCopied] = useState(false);

  const result = draftMutation.data;

  useEffect(() => {
    if (result !== undefined) {
      setDraftText(result.draft);
      setCopied(false);
    }
  }, [result]);

  async function handleCopy() {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      return;
    }
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Outreach draft</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={draftMutation.isPending}
            onClick={() => draftMutation.mutate(opportunityId)}
          >
            {draftMutation.isPending ? 'Generating…' : 'Generate draft'}
          </Button>
          {result !== undefined ? (
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          ) : null}
        </div>

        {draftMutation.isError ? (
          <p className="text-sm text-destructive">{errorMessage(draftMutation.error)}</p>
        ) : null}

        {result !== undefined ? (
          <textarea
            className="min-h-[160px] w-full resize-y rounded-md border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
          />
        ) : null}

        <p className="text-xs text-muted-foreground">
          Draft only — review and send it yourself; the system never contacts anyone.
        </p>
      </CardContent>
    </Card>
  );
}

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const opportunityQuery = useOpportunity(id);
  const statusMutation = useSetOpportunityStatus();
  const feedbackMutation = useSendFeedback();
  const createLeadMutation = useCreateLead();
  const [statusOverride, setStatusOverride] = useState<OpportunityStatus | null>(null);

  if (id === undefined) {
    return <DetailState title="Opportunity not found" message="No opportunity id was provided." />;
  }

  if (opportunityQuery.isPending) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading opportunity…
        </CardContent>
      </Card>
    );
  }

  if (opportunityQuery.isError) {
    return (
      <DetailState
        title="Opportunity not found"
        message={errorMessage(opportunityQuery.error)}
      />
    );
  }

  const opportunity = opportunityQuery.data;
  if (opportunity === undefined) {
    return (
      <DetailState title="Opportunity not found" message="This opportunity could not be loaded." />
    );
  }

  const score = coerceScore(opportunity.leadScore?.totalScore);
  const band = scoreBand(score);
  const statusValue = statusOverride ?? opportunity.status;

  function handleStatusChange(next: OpportunityStatus) {
    setStatusOverride(next);
    statusMutation.mutate(
      { id: opportunity.id, status: next },
      { onSettled: () => setStatusOverride(null) },
    );
  }

  function handleFeedback(isRelevant: boolean) {
    feedbackMutation.mutate({ id: opportunity.id, input: { isRelevant } });
  }

  function handleCreateLead() {
    createLeadMutation.mutate(
      { opportunityId: opportunity.id },
      { onSuccess: () => navigate('/leads') },
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/opportunities"
        className="inline-flex text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to inbox
      </Link>

      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABELS[opportunity.opportunityType]}</Badge>
          <Badge variant="muted">{formatLabel(opportunity.status)}</Badge>
          <Badge variant="outline">{INTENT_LABELS[opportunity.buyingIntent]}</Badge>
          <Badge variant="outline">{formatLabel(opportunity.engagementType)}</Badge>
          <Badge className={`${band.className} px-3 py-1 text-sm`}>
            {band.label}
            {score !== null ? ` · ${Math.round(score)}` : ''}
          </Badge>
        </div>
      </div>

      <OverviewCard opportunity={opportunity} />

      <ScoreBreakdownCard leadScore={opportunity.leadScore} />

      <SkillsCard skills={opportunity.skills} />

      <EvidenceList evidence={opportunity.evidence} />

      <OutreachDraftCard opportunityId={opportunity.id} />

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-4 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              value={statusValue}
              onChange={(event) => handleStatusChange(event.target.value as OpportunityStatus)}
              disabled={statusMutation.isPending}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
            {statusMutation.isError ? (
              <p className="text-sm text-destructive">{errorMessage(statusMutation.error)}</p>
            ) : null}
            {statusMutation.isSuccess ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Status updated.</p>
            ) : null}
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Relevance
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={feedbackMutation.isPending}
                onClick={() => handleFeedback(true)}
              >
                Mark relevant
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={feedbackMutation.isPending}
                onClick={() => handleFeedback(false)}
              >
                Mark not relevant
              </Button>
            </div>
            {feedbackMutation.isError ? (
              <p className="text-sm text-destructive">{errorMessage(feedbackMutation.error)}</p>
            ) : null}
            {feedbackMutation.isSuccess ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Feedback recorded.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Promote
            </span>
            <div>
              <Button disabled={createLeadMutation.isPending} onClick={handleCreateLead}>
                {createLeadMutation.isPending ? 'Creating…' : 'Create lead'}
              </Button>
            </div>
            {createLeadMutation.isError ? (
              <p className="text-sm text-destructive">{errorMessage(createLeadMutation.error)}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
