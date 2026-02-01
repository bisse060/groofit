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
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--border))" 
            opacity={0.5}
          />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={(v) => `${v}u`} 
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Line
            dataKey="hours"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
