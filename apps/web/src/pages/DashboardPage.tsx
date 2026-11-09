import { ApiStatus } from '@/components/ApiStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardSection {
  title: string;
  description: string;
}

const DASHBOARD_SECTIONS: DashboardSection[] = [
  { title: 'Newly discovered', description: 'Fresh opportunities awaiting triage.' },
  { title: 'High-priority', description: 'Signals scored above the priority threshold.' },
  { title: 'Qualified leads', description: 'Leads that have passed qualification.' },
  { title: 'Recent problem clusters', description: 'Groups of recurring pain points, clustered.' },
];

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Phase 0 shell — live data features arrive in later phases.
          </p>
        </div>
        <ApiStatus />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DASHBOARD_SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
              Nothing here yet
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
