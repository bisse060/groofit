import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

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

  if (loading || !latestSleep) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Slaap (laatste nacht)</CardTitle>
        <Link to="/sleep" className="text-xs text-primary hover:underline">
          Details
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Duur</p>
            <p className="font-semibold">
              {Math.floor((latestSleep.duration_minutes ?? 0) / 60)}u{' '}
              {(latestSleep.duration_minutes ?? 0) % 60}m
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="font-semibold">{latestSleep.score ?? '—'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}