import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Moon, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

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
      // Get sleep logs for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('sleep_logs')
        .select('date, score, duration_minutes, efficiency')
        .eq('user_id', user?.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setSleepData(data);

        // Calculate stats
        const scores = data.filter(d => d.score).map(d => d.score);
        const durations = data.filter(d => d.duration_minutes).map(d => d.duration_minutes);

        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        const avgMinutes = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

        const avgHours = Math.round(avgMinutes / 60 * 10) / 10;

        // Find best and worst nights
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
      <Card className="col-span-full">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Slaapdata laden...</p>
        </CardContent>
      </Card>
    );
  }

  if (sleepData.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Slaapanalyse (afgelopen 30 dagen)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Nog geen slaapdata beschikbaar. Sync je Fitbit om slaapdata te laden.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const chartData = sleepData.map(item => ({
    date: format(new Date(item.date), 'd MMM', { locale: nl }),
    hours: item.duration_minutes ? Math.round(item.duration_minutes / 60 * 10) / 10 : 0,
    score: item.score || 0,
  }));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Moon className="h-5 w-5" />
          Slaapanalyse (afgelopen 30 dagen)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Gem. Slaapscore</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              {stats.avgScore}
              <span className="text-sm text-muted-foreground">/100</span>
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Gem. Slaapuren</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              {stats.avgHours}
              <Clock className="h-4 w-4 text-muted-foreground" />
            </p>
          </div>

          {stats.bestNight && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Beste Nacht
              </p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.bestNight.score}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(stats.bestNight.date), 'd MMM', { locale: nl })}
              </p>
            </div>
          )}

          {stats.worstNight && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Slechtste Nacht
              </p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {stats.worstNight.score}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(stats.worstNight.date), 'd MMM', { locale: nl })}
              </p>
            </div>
          )}
        </div>

        {/* Sleep Hours Chart */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Slaapuren per Nacht</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                label={{ value: 'Uren', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number) => [`${value} uur`, 'Slaapduur']}
              />
              <Line 
                type="monotone" 
                dataKey="hours" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sleep Score Chart */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Slaapscore per Nacht</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                domain={[0, 100]}
                label={{ value: 'Score', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number) => [`${value}/100`, 'Slaapscore']}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--secondary))', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Gebaseerd op {sleepData.length} nachten slaapdata uit de afgelopen 30 dagen
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
