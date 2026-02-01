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
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--border))" 
            opacity={0.5}
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={(v) => `${v}m`} 
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
          <Legend 
            wrapperStyle={{ fontSize: '11px' }}
          />
          <Bar 
            dataKey="deep" 
            name="Deep" 
            stackId="a" 
            fill="hsl(var(--primary))" 
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="rem" 
            name="REM" 
            stackId="a" 
            fill="hsl(var(--secondary))" 
          />
          <Bar 
            dataKey="light" 
            name="Light" 
            stackId="a" 
            fill="hsl(var(--muted-foreground))" 
            opacity={0.3}
          />
          <Bar 
            dataKey="wake" 
            name="Wake" 
            stackId="a" 
            fill="hsl(var(--destructive))" 
            opacity={0.5}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
