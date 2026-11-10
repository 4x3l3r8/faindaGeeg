import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useCluster,
  useClusters,
  useGenerateServiceIdea,
  useRebuildClusters,
} from '@/lib/hooks';
import { coerceScore, scoreBand } from '@/lib/score';
import type {
  ClusterMemberView,
  ProblemClusterDetail,
  ProblemClusterRow,
  ServiceIdea,
} from '@/lib/types';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null): string {
  if (value === null || value === '') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatScore(value: number | string | null): string {
  const score = coerceScore(value);
  return score === null ? '—' : score.toFixed(1);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function DemandBadge({ score }: { score: number | string | null }) {
  const band = scoreBand(coerceScore(score));
  return <Badge className={band.className}>{band.label}</Badge>;
}

function ClusterListItem({
  cluster,
  selected,
  onSelect,
}: {
  cluster: ProblemClusterRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
          selected ? 'border-primary bg-accent' : 'border-border bg-card'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="font-medium">{cluster.title}</span>
          <DemandBadge score={cluster.demandScore} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{cluster.memberCount} members</Badge>
          <Badge variant="outline">{cluster.independentSourceCount} independent sources</Badge>
          <Badge variant="muted">{formatLabel(cluster.validationStatus)}</Badge>
        </div>
      </button>
    </li>
  );
}

function MemberItem({ member }: { member: ClusterMemberView }) {
  return (
    <li className="space-y-1 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{member.title}</span>
        <Badge variant="outline">{formatLabel(member.opportunityType)}</Badge>
      </div>
      {member.excerpt !== null && member.excerpt !== undefined && member.excerpt !== '' ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{member.excerpt}</p>
      ) : null}
      {member.sourceUrl !== null && member.sourceUrl !== undefined && member.sourceUrl !== '' ? (
        <a
          href={member.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View source →
        </a>
      ) : null}
    </li>
  );
}

function ServiceIdeaItem({ idea }: { idea: ServiceIdea }) {
  return (
    <li className="space-y-1 rounded-md border border-border p-3">
      <span className="text-sm font-medium">{idea.title}</span>
      <p className="text-sm text-muted-foreground">{idea.suggestedService}</p>
      {idea.requiredSkills.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {idea.requiredSkills.map((skill) => (
            <Badge key={skill} variant="secondary">
              {skill}
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function ClusterDetail({ id }: { id: string }) {
  const query = useCluster(id);
  const generate = useGenerateServiceIdea();

  if (query.isPending) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading cluster…
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
          This cluster could not be loaded.
        </CardContent>
      </Card>
    );
  }

  return <ClusterDetailBody key={query.data.id} id={id} cluster={query.data} generate={generate} />;
}

function ClusterDetailBody({
  id,
  cluster,
  generate,
}: {
  id: string;
  cluster: ProblemClusterDetail;
  generate: ReturnType<typeof useGenerateServiceIdea>;
}) {
  const members = cluster.members ?? [];
  const serviceIdeas = cluster.serviceIdeas ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {cluster.title}
            <DemandBadge score={cluster.demandScore} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2">
          {cluster.description !== null && cluster.description !== '' ? (
            <p className="text-sm">{cluster.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description recorded.</p>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Target audience
              </dt>
              <dd>{cluster.targetAudience ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Members
              </dt>
              <dd className="tabular-nums">{cluster.memberCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Independent sources
              </dt>
              <dd className="tabular-nums">{cluster.independentSourceCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Demand score
              </dt>
              <dd className="tabular-nums">{formatScore(cluster.demandScore)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                First observed
              </dt>
              <dd>{formatDate(cluster.firstObservedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last observed
              </dt>
              <dd>{formatDate(cluster.lastObservedAt)}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => generate.mutate(id)}
              disabled={generate.isPending}
            >
              {generate.isPending ? 'Generating…' : 'Generate service idea'}
            </Button>
            {generate.error ? (
              <span className="text-sm text-destructive">{errorMessage(generate.error)}</span>
            ) : null}
            {generate.isSuccess ? (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">Idea generated.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No supporting evidence linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <MemberItem key={member.opportunityId} member={member} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Potential services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Suggested services are hypotheses from the evidence, not proven demand.
          </p>
          {serviceIdeas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No service ideas yet — generate one above.
            </p>
          ) : (
            <ul className="space-y-2">
              {serviceIdeas.map((idea) => (
                <ServiceIdeaItem key={idea.id} idea={idea} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ProblemsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const clusters = useClusters();
  const rebuild = useRebuildClusters();

  const rows = clusters.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problem Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Recurring-problem clusters, their evidence, and potential services.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => rebuild.mutate(undefined)} disabled={rebuild.isPending}>
            {rebuild.isPending ? 'Rebuilding…' : 'Rebuild clusters'}
          </Button>
          {rebuild.data ? (
            <p className="text-xs text-muted-foreground">
              Embedded {rebuild.data.opportunitiesEmbedded}, created {rebuild.data.clustersCreated},
              added {rebuild.data.membersAdded} members across {rebuild.data.clustersTouched}{' '}
              clusters.
            </p>
          ) : null}
          {rebuild.error ? (
            <p className="text-xs text-destructive">{errorMessage(rebuild.error)}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          {clusters.isPending ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Loading clusters…
              </CardContent>
            </Card>
          ) : null}

          {clusters.isError ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-destructive">
                {errorMessage(clusters.error)}
              </CardContent>
            </Card>
          ) : null}

          {clusters.data && rows.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No clusters yet — ingest and rebuild.
              </CardContent>
            </Card>
          ) : null}

          <ul className="space-y-2">
            {rows.map((cluster) => (
              <ClusterListItem
                key={cluster.id}
                cluster={cluster}
                selected={selectedId === cluster.id}
                onSelect={() => setSelectedId(cluster.id)}
              />
            ))}
          </ul>
        </div>

        <div>
          {selectedId === null ? (
            <Card>
              <CardContent className="flex min-h-[240px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Select a cluster
              </CardContent>
            </Card>
          ) : (
            <ClusterDetail id={selectedId} />
          )}
        </div>
      </div>
    </div>
  );
}
