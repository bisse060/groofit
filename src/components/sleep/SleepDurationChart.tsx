import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface SleepLog {
  date: string;
  duration_minutes: number | null;
}

interface SleepDurationChartProps {
  logs: SleepLog[];
}

export function SleepDurationChart({ logs }: SleepDurationChartProps) {
  const last30 = [...logs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30)
    .map((l) => ({
      date: l.date.slice(5),
      hours: ((l.duration_minutes ?? 0) / 60).toFixed(1),
    }));

  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={last30}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis tickFormatter={(v) => `${v}u`} className="text-xs" />
          <Tooltip />
          <Line
            dataKey="hours"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
