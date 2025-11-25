import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface SleepLog {
  date: string;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  wake_minutes: number | null;
}

interface SleepPhasesChartProps {
  logs: SleepLog[];
}

export function SleepPhasesChart({ logs }: SleepPhasesChartProps) {
  const last30 = [...logs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30)
    .map((l) => ({
      date: l.date.slice(5),
      deep: l.deep_minutes ?? 0,
      rem: l.rem_minutes ?? 0,
      light: l.light_minutes ?? 0,
      wake: l.wake_minutes ?? 0,
    }));

  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={last30}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis tickFormatter={(v) => `${v}m`} className="text-xs" />
          <Tooltip />
          <Legend />
          <Bar dataKey="deep" stackId="a" fill="hsl(var(--primary))" />
          <Bar dataKey="rem" stackId="a" fill="hsl(var(--secondary))" />
          <Bar dataKey="light" stackId="a" fill="hsl(var(--muted-foreground))" opacity={0.4} />
          <Bar dataKey="wake" stackId="a" fill="hsl(var(--destructive))" opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
