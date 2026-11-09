import { Card, CardContent } from '@/components/ui/card';

export function SourcesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <p className="text-sm text-muted-foreground">
          Manage the feeds and sources the system monitors.
        </p>
      </div>
      <Card>
        <CardContent className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          Coming in a later phase
        </CardContent>
      </Card>
    </div>
  );
}
