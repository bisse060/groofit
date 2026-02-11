import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Moon, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale/nl';

export default function SleepAnalysis() {
  const { user } = useAuth();
  const [sleepData, setSleepData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    avgScore: 0,
    avgHours: 0,
    bestNight: null as any,
    worstNight: null as any,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSleepAnalysis();
    }
  }, [user]);

  const loadSleepAnalysis = async () => {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from('sleep_logs')
        .select('date, score, duration_minutes, efficiency')
        .eq('user_id', user?.id)
        .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setSleepData(data);

        const scores = data.filter(d => d.score).map(d => d.score);
        const durations = data.filter(d => d.duration_minutes).map(d => d.duration_minutes);

        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        const avgMinutes = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

        const avgHours = Math.round(avgMinutes / 60 * 10) / 10;

        const sortedByScore = [...data].filter(d => d.score).sort((a, b) => (b.score || 0) - (a.score || 0));
        const bestNight = sortedByScore[0] || null;
        const worstNight = sortedByScore[sortedByScore.length - 1] || null;

        setStats({ avgScore, avgHours, bestNight, worstNight });
      }
    } catch (error) {
      console.error('Error loading sleep analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Slaapanalyse
        </h2>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
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

  if (sleepData.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Slaapanalyse
        </h2>
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Moon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Geen slaapdata voor afgelopen 90 dagen
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const chartData = sleepData.map(item => ({
    date: format(new Date(item.date), 'd MMM', { locale: nl }),
    hours: item.duration_minutes ? Math.round(item.duration_minutes / 60 * 10) / 10 : 0,
    score: item.score || 0,
  }));

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Slaapanalyse (90 dagen)
      </h2>
      <Card>
        <CardContent className="p-4 space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Gem. Score</p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.avgScore}
                <span className="text-xs text-muted-foreground ml-1">/100</span>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Gem. Slaap</p>
              <p className="text-xl font-semibold tabular-nums flex items-center gap-1">
                {stats.avgHours}
                <span className="text-xs text-muted-foreground">u</span>
              </p>
            </div>

            {stats.bestNight && (
              <div className="p-3 rounded-lg bg-success/10">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  Beste
                </p>
                <p className="text-xl font-semibold tabular-nums text-success">
                  {stats.bestNight.score}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(stats.bestNight.date), 'd MMM', { locale: nl })}
                </p>
              </div>
            )}

            {stats.worstNight && (
              <div className="p-3 rounded-lg bg-secondary/10">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-secondary" />
                  Slechtste
                </p>
                <p className="text-xl font-semibold tabular-nums text-secondary">
                  {stats.worstNight.score}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(stats.worstNight.date), 'd MMM', { locale: nl })}
                </p>
              </div>
            )}
          </div>

          {/* Sleep Hours Chart */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Slaapuren</h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
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
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value} uur`, 'Slaapduur']}
                />
                <Line 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sleep Score Chart */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Slaapscore</h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
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
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}/100`, 'Score']}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--secondary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
            Gebaseerd op {sleepData.length} nachten
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
