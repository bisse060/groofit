import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Footprints, Flame, TrendingUp, Calendar } from 'lucide-react';

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

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('log_date, calorie_intake, calorie_burn, workout_completed')
        .eq('user_id', user?.id)
        .gte('log_date', date30d.toISOString().split('T')[0])
        .order('log_date', { ascending: false });

      if (logs) {
        const logs7d = logs.filter(log => new Date(log.log_date) >= date7d);
        
        const totalIntake = logs7d.reduce((sum, log) => sum + (log.calorie_intake || 0), 0);
        const totalBurn = logs7d.reduce((sum, log) => sum + (log.calorie_burn || 0), 0);
        const count7d = logs7d.filter(log => log.calorie_intake || log.calorie_burn).length;

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
      title: 'Gem. Intake',
      subtitle: '7 dagen',
      value: stats.avgCalorieIntake7d > 0 ? stats.avgCalorieIntake7d : '-',
      unit: stats.avgCalorieIntake7d > 0 ? 'kcal' : '',
      icon: Footprints,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'Gem. Verbranding',
      subtitle: '7 dagen',
      value: stats.avgCalorieBurn7d > 0 ? stats.avgCalorieBurn7d : '-',
      unit: stats.avgCalorieBurn7d > 0 ? 'kcal' : '',
      icon: Flame,
      iconBg: 'bg-secondary/10',
      iconColor: 'text-secondary',
    },
    {
      title: 'Workouts',
      subtitle: '7 dagen',
      value: stats.workouts7d,
      unit: '',
      icon: TrendingUp,
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
    {
      title: 'Workouts',
      subtitle: '30 dagen',
      value: stats.workouts30d,
      unit: '',
      icon: Calendar,
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Week & Maand Highlights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Week & Maand Highlights
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {highlights.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="card-interactive">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    <p className="text-[10px] text-muted-foreground/70">{stat.subtitle}</p>
                  </div>
                  <div className={`p-1.5 rounded-lg ${stat.iconBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
                  </div>
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {stat.value}
                  {stat.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{stat.unit}</span>}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
