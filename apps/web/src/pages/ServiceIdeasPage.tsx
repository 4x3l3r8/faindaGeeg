import { Card, CardContent } from '@/components/ui/card';

export function ServiceIdeasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service Ideas</h1>
        <p className="text-sm text-muted-foreground">
          Shape opportunities into concrete service offerings.
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
