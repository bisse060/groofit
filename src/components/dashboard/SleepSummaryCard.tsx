import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Moon, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale/nl';

interface SleepNight {
  date: string;
  duration_minutes: number | null;
  score: number | null;
  efficiency: number | null;
}

export default function SleepSummaryCard() {
  const { user } = useAuth();
  const [nights, setNights] = useState<SleepNight[]>([]);
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
        .select('date, score, duration_minutes, efficiency')
        .eq('user_id', user?.id)
        .gte('date', weekAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setNights(data || []);
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

  if (nights.length === 0) return null;

  const durations = nights.filter(n => n.duration_minutes != null).map(n => n.duration_minutes!);
  const scores = nights.filter(n => n.score != null).map(n => n.score!);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const avgHours = Math.floor(avgDuration / 60);
  const avgMins = avgDuration % 60;

  const formatDuration = (mins: number | null) => {
    if (mins == null) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}u${m > 0 ? ` ${m}m` : ''}`;
  };

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
                <p className="text-xs text-muted-foreground">Afgelopen week</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Weekly average */}
          <div className="flex items-end gap-4 mb-3 pb-3 border-b border-border">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Gem. duur</p>
              <p className="text-lg font-semibold tabular-nums">
                {avgHours}<span className="text-xs font-normal text-muted-foreground">u </span>
                {avgMins}<span className="text-xs font-normal text-muted-foreground">m</span>
              </p>
            </div>
            {avgScore != null && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Gem. score</p>
                <p className="text-lg font-semibold tabular-nums">{avgScore}</p>
              </div>
            )}
          </div>

          {/* Per night */}
          <div className="space-y-1.5">
            {nights.map((night) => (
              <div key={night.date} className="flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground w-12">
                  {format(new Date(night.date), 'EEE', { locale: nl })}
                </span>
                <div className="flex-1 mx-2">
                  <div
                    className="h-2 rounded-full bg-primary/20"
                    style={{ width: '100%' }}
                  >
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, ((night.duration_minutes || 0) / 540) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs tabular-nums font-medium w-12 text-right">
                  {formatDuration(night.duration_minutes)}
                </span>
                {night.score != null && (
                  <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right ml-1">
                    {night.score}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
