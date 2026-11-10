import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useServiceIdeas } from '@/lib/hooks';
import type { ServiceIdea } from '@/lib/types';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function ServiceIdeaCard({ idea }: { idea: ServiceIdea }) {
  const clusterTitle = idea.clusterTitle ?? null;
  const requiredSkills = idea.requiredSkills ?? [];
  const validationQuestions = idea.validationQuestions ?? [];

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{idea.title}</CardTitle>
        {clusterTitle !== null && clusterTitle !== '' ? (
          <p className="text-xs text-muted-foreground">
            from cluster:{' '}
            <Link
              to="/problems"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {clusterTitle}
            </Link>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        <p className="text-sm">{idea.summary}</p>

        <div className="text-sm">
          <span className="font-medium">Suggested service:</span> {idea.suggestedService}
        </div>

        {requiredSkills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {requiredSkills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Engagement model:</span>
          {idea.engagementModel !== null && idea.engagementModel !== '' ? (
            <Badge variant="outline">{formatLabel(idea.engagementModel)}</Badge>
          ) : (
            <Badge variant="muted">Unknown</Badge>
          )}
        </div>

        <div className="text-sm">
          <span className="text-muted-foreground">Target customer:</span>{' '}
          {idea.targetCustomer !== null && idea.targetCustomer !== '' ? idea.targetCustomer : 'Unknown'}
        </div>

        {validationQuestions.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Validation questions
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {validationQuestions.map((question, index) => (
                <li key={`${idea.id}-question-${index}`}>{question}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {idea.nextAction !== null && idea.nextAction !== '' ? (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <span className="font-medium">Next action:</span> {idea.nextAction}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ServiceIdeasPage() {
  const ideas = useServiceIdeas();
  const rows = ideas.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service Ideas</h1>
        <p className="text-sm text-muted-foreground">
          Draft service offerings generated from problem clusters.
        </p>
        <p className="text-xs text-muted-foreground">
          Draft offerings inferred from clustered evidence — hypotheses to validate, not proven
          demand.
        </p>
      </div>

      {ideas.isPending ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Loading service ideas…
          </CardContent>
        </Card>
      ) : null}

      {ideas.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center text-sm text-destructive">
            <span>{errorMessage(ideas.error)}</span>
            <Button size="sm" variant="outline" onClick={() => ideas.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ideas.data && rows.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[240px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
            <span>
              No service ideas yet — generate one from a cluster on the{' '}
              <Link
                to="/problems"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Problem Intelligence
              </Link>{' '}
              page.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {rows.map((idea) => (
          <ServiceIdeaCard key={idea.id} idea={idea} />
        ))}
      </div>
    </div>
  );
}
