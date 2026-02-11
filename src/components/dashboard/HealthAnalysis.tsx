import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Footprints, Flame, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale/nl';

export default function HealthAnalysis() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    avgSteps: 0,
    avgCalorieBurn: 0,
    bestStepsDay: null as any,
    totalActiveDays: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: logs, error } = await supabase
        .from('daily_logs')
        .select('log_date, steps, calorie_burn, calorie_intake, weight')
        .eq('user_id', user?.id)
        .gte('log_date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('log_date', { ascending: true });

      if (error) throw error;

      if (logs && logs.length > 0) {
        setData(logs);

        const stepsArr = logs.filter(d => d.steps && d.steps > 0).map(d => d.steps!);
        const burnArr = logs.filter(d => d.calorie_burn && d.calorie_burn > 0).map(d => d.calorie_burn!);

        const avgSteps = stepsArr.length > 0
          ? Math.round(stepsArr.reduce((a, b) => a + b, 0) / stepsArr.length)
          : 0;

        const avgCalorieBurn = burnArr.length > 0
          ? Math.round(burnArr.reduce((a, b) => a + b, 0) / burnArr.length)
          : 0;

        const bestStepsDay = stepsArr.length > 0
          ? logs.filter(d => d.steps && d.steps > 0).sort((a, b) => (b.steps || 0) - (a.steps || 0))[0]
          : null;

        const totalActiveDays = logs.filter(d => (d.steps || 0) >= 8000).length;

        setStats({ avgSteps, avgCalorieBurn, bestStepsDay, totalActiveDays });
      }
    } catch (error) {
      console.error('Error loading health analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-16 bg-muted rounded-lg" />
                ))}
              </div>
              <div className="h-[180px] bg-muted rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (data.length === 0) {
    return (
      <section className="space-y-3">
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Geen gezondheidsdata voor afgelopen 90 dagen
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const stepsChartData = data
    .filter(d => d.steps && d.steps > 0)
    .map(item => ({
      date: format(new Date(item.log_date), 'd MMM', { locale: nl }),
      steps: item.steps || 0,
    }));

  const calorieChartData = data
    .filter(d => (d.calorie_burn && d.calorie_burn > 0) || (d.calorie_intake && d.calorie_intake > 0))
    .map(item => ({
      date: format(new Date(item.log_date), 'd MMM', { locale: nl }),
      verbranding: item.calorie_burn || 0,
      inname: item.calorie_intake || 0,
    }));

  return (
    <section className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Gem. Stappen</p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.avgSteps.toLocaleString()}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Gem. Verbranding</p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.avgCalorieBurn.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">kcal</span>
              </p>
            </div>

            {stats.bestStepsDay && (
              <div className="p-3 rounded-lg bg-success/10">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  Meeste stappen
                </p>
                <p className="text-xl font-semibold tabular-nums text-success">
                  {(stats.bestStepsDay.steps || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(stats.bestStepsDay.log_date), 'd MMM', { locale: nl })}
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Footprints className="h-3 w-3 text-primary" />
                Actieve dagen
              </p>
              <p className="text-xl font-semibold tabular-nums text-primary">
                {stats.totalActiveDays}
              </p>
              <p className="text-[10px] text-muted-foreground">≥ 8.000 stappen</p>
            </div>
          </div>

          {/* Steps Chart */}
          {stepsChartData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Stappen</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stepsChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Stappen']}
                  />
                  <Bar
                    dataKey="steps"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Calorie Chart */}
          {calorieChartData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Calorieën</h4>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={calorieChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} kcal`,
                      name === 'verbranding' ? 'Verbranding' : 'Inname',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="verbranding"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'hsl(var(--secondary))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="inname"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
            Gebaseerd op {data.length} dagen
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
