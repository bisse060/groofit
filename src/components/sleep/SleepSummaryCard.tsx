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
    return (
      <>
        {hours}<span className="text-muted-foreground">u </span>
        {mins}<span className="text-muted-foreground">m</span>
      </>
    );
  };

  const stats = [
    { label: 'Duur', value: formatDuration(log.duration_minutes) },
    { label: 'Score', value: log.score ?? '—' },
    { label: 'Deep + REM', value: formatDuration((log.deep_minutes ?? 0) + (log.rem_minutes ?? 0)) },
    { label: 'Wakker', value: formatDuration(log.wake_minutes) },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Laatste nacht</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index}>
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
