import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SleepLog {
  date: string;
  duration_minutes: number | null;
  score: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  wake_minutes: number | null;
}

interface SleepSummaryCardProps {
  log: SleepLog;
}

export function SleepSummaryCard({ log }: SleepSummaryCardProps) {
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0u 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}u ${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laatste nacht</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Duur</p>
          <p className="text-lg font-semibold">{formatDuration(log.duration_minutes)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-lg font-semibold">{log.score ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Deep + REM</p>
          <p className="text-lg font-semibold">
            {formatDuration((log.deep_minutes ?? 0) + (log.rem_minutes ?? 0))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Wake</p>
          <p className="text-lg font-semibold">{formatDuration(log.wake_minutes)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
