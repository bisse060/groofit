import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Flame, TrendingUp, Calendar } from 'lucide-react';

interface Stats {
  avgCalorieIntake7d: number;
  avgCalorieBurn7d: number;
  workouts7d: number;
  workouts30d: number;
}

export default function CrossDayHighlights() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    avgCalorieIntake7d: 0,
    avgCalorieBurn7d: 0,
    workouts7d: 0,
    workouts30d: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const date7d = new Date();
      date7d.setDate(date7d.getDate() - 7);

      const date30d = new Date();
      date30d.setDate(date30d.getDate() - 30);

      // Get logs for last 30 days
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('log_date, calorie_intake, calorie_burn, workout_completed')
        .eq('user_id', user?.id)
        .gte('log_date', date30d.toISOString().split('T')[0])
        .order('log_date', { ascending: false });

      if (logs) {
        const logs7d = logs.filter(log => new Date(log.log_date) >= date7d);
        
        // Calculate averages for last 7 days
        const totalIntake = logs7d.reduce((sum, log) => sum + (log.calorie_intake || 0), 0);
        const totalBurn = logs7d.reduce((sum, log) => sum + (log.calorie_burn || 0), 0);
        const count7d = logs7d.filter(log => log.calorie_intake || log.calorie_burn).length;

        // Count workouts
        const workouts7d = logs7d.filter(log => log.workout_completed).length;
        const workouts30d = logs.filter(log => log.workout_completed).length;

        setStats({
          avgCalorieIntake7d: count7d > 0 ? Math.round(totalIntake / count7d) : 0,
          avgCalorieBurn7d: count7d > 0 ? Math.round(totalBurn / count7d) : 0,
          workouts7d,
          workouts30d,
        });
      }
    } catch (error) {
      console.error('Error loading highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  const highlights = [
    {
      title: 'Gem. Calorie-inname',
      subtitle: 'Laatste 7 dagen',
      value: stats.avgCalorieIntake7d > 0 ? `${stats.avgCalorieIntake7d} kcal` : '-',
      icon: Activity,
      color: 'text-primary',
    },
    {
      title: 'Gem. Calorieën Verbrand',
      subtitle: 'Laatste 7 dagen',
      value: stats.avgCalorieBurn7d > 0 ? `${stats.avgCalorieBurn7d} kcal` : '-',
      icon: Flame,
      color: 'text-secondary',
    },
    {
      title: 'Workouts',
      subtitle: 'Laatste 7 dagen',
      value: stats.workouts7d,
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      title: 'Workouts',
      subtitle: 'Laatste 30 dagen',
      value: stats.workouts30d,
      icon: Calendar,
      color: 'text-accent',
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Week & Maand Highlights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Week & Maand Highlights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {highlights.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </div>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}