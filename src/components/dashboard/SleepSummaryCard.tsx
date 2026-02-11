import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Moon, ChevronRight } from 'lucide-react';

interface WeeklySleep {
  avgDuration: number;
  avgScore: number | null;
  avgEfficiency: number | null;
  nights: number;
}

export default function SleepSummaryCard() {
  const { user } = useAuth();
  const [weekly, setWeekly] = useState<WeeklySleep | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadWeeklySleep();
  }, [user]);

  const loadWeeklySleep = async () => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('sleep_logs')
        .select('score, duration_minutes, efficiency')
        .eq('user_id', user?.id)
        .gte('date', weekAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const durations = data.filter(d => d.duration_minutes != null).map(d => d.duration_minutes!);
        const scores = data.filter(d => d.score != null).map(d => d.score!);
        const efficiencies = data.filter(d => d.efficiency != null).map(d => d.efficiency!);

        setWeekly({
          avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          avgEfficiency: efficiencies.length > 0 ? Math.round(efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length) : null,
          nights: data.length,
        });
      }
    } catch (error) {
      console.error('Error loading sleep data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!weekly) return null;

  const hours = Math.floor(weekly.avgDuration / 60);
  const mins = weekly.avgDuration % 60;

  return (
    <Link to="/health">
      <Card className="card-interactive h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Moon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Slaap</p>
                <p className="text-xs text-muted-foreground">Gem. afgelopen {weekly.nights} nachten</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Duur</p>
              <p className="text-xl font-semibold tabular-nums">
                {hours}<span className="text-sm font-normal text-muted-foreground">u </span>
                {mins}<span className="text-sm font-normal text-muted-foreground">m</span>
              </p>
            </div>
            {weekly.avgScore != null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Score</p>
                <p className="text-xl font-semibold tabular-nums">{weekly.avgScore}</p>
              </div>
            )}
            {weekly.avgEfficiency != null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Efficiëntie</p>
                <p className="text-xl font-semibold tabular-nums">{weekly.avgEfficiency}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
