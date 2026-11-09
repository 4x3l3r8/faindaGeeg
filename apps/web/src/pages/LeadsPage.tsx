import { Card, CardContent } from '@/components/ui/card';

export function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads / CRM</h1>
        <p className="text-sm text-muted-foreground">
          Track qualified leads and the relationships around them.
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
