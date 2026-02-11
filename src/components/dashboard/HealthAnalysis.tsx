import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Footprints, Flame, TrendingUp, Activity, Heart, Timer, Route } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, AreaChart, Area } from 'recharts';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale/nl';

export default function HealthAnalysis() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    avgSteps: 0,
    avgCalorieBurn: 0,
    avgRestingHR: 0,
    lowestRestingHR: null as any,
    bestStepsDay: null as any,
    totalActiveDays: 0,
    avgActiveMinutes: 0,
    totalDistanceKm: 0,
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
        .select('log_date, steps, calorie_burn, calorie_intake, weight, resting_heart_rate, heart_rate_fat_burn_minutes, heart_rate_cardio_minutes, heart_rate_peak_minutes, active_minutes_lightly, active_minutes_fairly, active_minutes_very, distance_km')
        .eq('user_id', user?.id)
        .gte('log_date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('log_date', { ascending: true });

      if (error) throw error;

      if (logs && logs.length > 0) {
        setData(logs);

        const stepsArr = logs.filter(d => d.steps && d.steps > 0).map(d => d.steps!);
        const burnArr = logs.filter(d => d.calorie_burn && d.calorie_burn > 0).map(d => d.calorie_burn!);
        const hrArr = logs.filter(d => d.resting_heart_rate && d.resting_heart_rate > 0).map(d => d.resting_heart_rate!);
        const activeArr = logs.filter(d => (d.active_minutes_fairly || 0) + (d.active_minutes_very || 0) > 0)
          .map(d => (d.active_minutes_fairly || 0) + (d.active_minutes_very || 0));

        const avgSteps = stepsArr.length > 0
          ? Math.round(stepsArr.reduce((a, b) => a + b, 0) / stepsArr.length)
          : 0;

        const avgCalorieBurn = burnArr.length > 0
          ? Math.round(burnArr.reduce((a, b) => a + b, 0) / burnArr.length)
          : 0;

        const avgRestingHR = hrArr.length > 0
          ? Math.round(hrArr.reduce((a, b) => a + b, 0) / hrArr.length)
          : 0;

        const lowestRestingHR = hrArr.length > 0
          ? logs.filter(d => d.resting_heart_rate && d.resting_heart_rate > 0)
              .sort((a, b) => (a.resting_heart_rate || 999) - (b.resting_heart_rate || 999))[0]
          : null;

        const bestStepsDay = stepsArr.length > 0
          ? logs.filter(d => d.steps && d.steps > 0).sort((a, b) => (b.steps || 0) - (a.steps || 0))[0]
          : null;

        const totalActiveDays = logs.filter(d => (d.steps || 0) >= 8000).length;

        const avgActiveMinutes = activeArr.length > 0
          ? Math.round(activeArr.reduce((a, b) => a + b, 0) / activeArr.length)
          : 0;

        const totalDistanceKm = logs.reduce((sum, d) => sum + (d.distance_km || 0), 0);

        setStats({ avgSteps, avgCalorieBurn, avgRestingHR, lowestRestingHR, bestStepsDay, totalActiveDays, avgActiveMinutes, totalDistanceKm });
      }
    } catch (error) {
      console.error('Error loading health analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
            <div className="h-[180px] bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
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
    );
  }

  // Chart data
  const hrChartData = data
    .filter(d => d.resting_heart_rate && d.resting_heart_rate > 0)
    .map(item => ({
      date: format(new Date(item.log_date), 'd MMM', { locale: nl }),
      bpm: item.resting_heart_rate,
    }));

  const stepsChartData = data
    .filter(d => d.steps && d.steps > 0)
    .map(item => ({
      date: format(new Date(item.log_date), 'd MMM', { locale: nl }),
      steps: item.steps || 0,
    }));

  const activeMinutesData = data
    .filter(d => (d.active_minutes_lightly || 0) + (d.active_minutes_fairly || 0) + (d.active_minutes_very || 0) > 0)
    .map(item => ({
      date: format(new Date(item.log_date), 'd MMM', { locale: nl }),
      licht: item.active_minutes_lightly || 0,
      matig: item.active_minutes_fairly || 0,
      intensief: item.active_minutes_very || 0,
    }));

  const hrZonesData = data
    .filter(d => (d.heart_rate_fat_burn_minutes || 0) + (d.heart_rate_cardio_minutes || 0) + (d.heart_rate_peak_minutes || 0) > 0)
    .map(item => ({
      date: format(new Date(item.log_date), 'd MMM', { locale: nl }),
      fatBurn: item.heart_rate_fat_burn_minutes || 0,
      cardio: item.heart_rate_cardio_minutes || 0,
      peak: item.heart_rate_peak_minutes || 0,
    }));

  const calorieChartData = data
    .filter(d => (d.calorie_burn && d.calorie_burn > 0) || (d.calorie_intake && d.calorie_intake > 0))
    .map(item => ({
      date: format(new Date(item.log_date), 'd MMM', { locale: nl }),
      verbranding: item.calorie_burn || 0,
      inname: item.calorie_intake || 0,
    }));

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.avgRestingHR > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Heart className="h-3 w-3 text-destructive" />
                Gem. Rusthartslag
              </p>
              <p className="text-xl font-semibold tabular-nums text-destructive">
                {stats.avgRestingHR}
                <span className="text-xs font-normal text-muted-foreground ml-1">bpm</span>
              </p>
            </div>
          )}

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

          {stats.avgActiveMinutes > 0 && (
            <div className="p-3 rounded-lg bg-secondary/10">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Timer className="h-3 w-3 text-secondary" />
                Gem. Actief
              </p>
              <p className="text-xl font-semibold tabular-nums text-secondary">
                {stats.avgActiveMinutes}
                <span className="text-xs font-normal text-muted-foreground ml-1">min</span>
              </p>
            </div>
          )}

          {stats.lowestRestingHR && (
            <div className="p-3 rounded-lg bg-success/10">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-success" />
                Laagste hartslag
              </p>
              <p className="text-xl font-semibold tabular-nums text-success">
                {stats.lowestRestingHR.resting_heart_rate}
                <span className="text-xs font-normal text-muted-foreground ml-1">bpm</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(stats.lowestRestingHR.log_date), 'd MMM', { locale: nl })}
              </p>
            </div>
          )}

          {stats.bestStepsDay && (
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Footprints className="h-3 w-3 text-primary" />
                Meeste stappen
              </p>
              <p className="text-xl font-semibold tabular-nums text-primary">
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

          {stats.totalDistanceKm > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Route className="h-3 w-3" />
                Totale afstand
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.totalDistanceKm.toFixed(1)}
                <span className="text-xs font-normal text-muted-foreground ml-1">km</span>
              </p>
            </div>
          )}
        </div>

        {/* Resting Heart Rate Chart */}
        {hrChartData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Heart className="h-3 w-3" /> Rusthartslag
            </h4>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={hrChartData}>
                <defs>
                  <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={35} domain={['dataMin - 3', 'dataMax + 3']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`${value} bpm`, 'Rusthartslag']}
                />
                <Area type="monotone" dataKey="bpm" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#hrGradient)" dot={false} activeDot={{ r: 4, fill: 'hsl(var(--destructive))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Heart Rate Zones Chart */}
        {hrZonesData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Hartslagzones (minuten)
            </h4>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={hrZonesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { fatBurn: 'Fat Burn', cardio: 'Cardio', peak: 'Peak' };
                    return [`${value} min`, labels[name] || name];
                  }}
                />
                <Bar dataKey="fatBurn" stackId="zones" fill="hsl(var(--warning, 45 93% 47%))" radius={[0, 0, 0, 0]} maxBarSize={12} />
                <Bar dataKey="cardio" stackId="zones" fill="hsl(var(--secondary))" radius={[0, 0, 0, 0]} maxBarSize={12} />
                <Bar dataKey="peak" stackId="zones" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Steps Chart */}
        {stepsChartData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Footprints className="h-3 w-3" /> Stappen
            </h4>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stepsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [value.toLocaleString(), 'Stappen']}
                />
                <Bar dataKey="steps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Active Minutes Chart */}
        {activeMinutesData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Timer className="h-3 w-3" /> Actieve minuten
            </h4>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={activeMinutesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { licht: 'Licht actief', matig: 'Matig actief', intensief: 'Intensief' };
                    return [`${value} min`, labels[name] || name];
                  }}
                />
                <Bar dataKey="licht" stackId="active" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[0, 0, 0, 0]} maxBarSize={12} />
                <Bar dataKey="matig" stackId="active" fill="hsl(var(--secondary))" radius={[0, 0, 0, 0]} maxBarSize={12} />
                <Bar dataKey="intensief" stackId="active" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Calorie Chart */}
        {calorieChartData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-3 w-3" /> Calorieën
            </h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={calorieChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} kcal`,
                    name === 'verbranding' ? 'Verbranding' : 'Inname',
                  ]}
                />
                <Line type="monotone" dataKey="verbranding" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'hsl(var(--secondary))' }} />
                <Line type="monotone" dataKey="inname" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
          Gebaseerd op {data.length} dagen
        </p>
      </CardContent>
    </Card>
  );
}