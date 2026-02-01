import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Moon, ChevronRight } from 'lucide-react';

export default function SleepSummaryCard() {
  const { user } = useAuth();
  const [latestSleep, setLatestSleep] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLatestSleep();
    }
  }, [user]);

  const loadLatestSleep = async () => {
    try {
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('score, duration_minutes')
        .eq('user_id', user?.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestSleep(data);
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

  if (!latestSleep) {
    return null;
  }

  const hours = Math.floor((latestSleep.duration_minutes ?? 0) / 60);
  const mins = (latestSleep.duration_minutes ?? 0) % 60;

  return (
    <Link to="/sleep">
      <Card className="card-interactive h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Moon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Slaap</p>
                <p className="text-xs text-muted-foreground">Laatste nacht</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Duur</p>
              <p className="text-2xl font-semibold tabular-nums">
                {hours}<span className="text-sm font-normal text-muted-foreground">u </span>
                {mins}<span className="text-sm font-normal text-muted-foreground">m</span>
              </p>
            </div>
            {latestSleep.score && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Score</p>
                <p className="text-2xl font-semibold tabular-nums">{latestSleep.score}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
