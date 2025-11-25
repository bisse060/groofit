import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Moon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SleepData {
  score: number;
  duration_minutes: number;
  deep_minutes: number;
  rem_minutes: number;
}

export default function SleepSummaryCard() {
  const { user } = useAuth();
  const [sleepData, setSleepData] = useState<SleepData | null>(null);
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
        .select('score, duration_minutes, deep_minutes, rem_minutes')
        .eq('user_id', user?.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSleepData(data);
    } catch (error) {
      console.error('Error loading sleep data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}u ${mins}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-orange-500';
    return 'text-red-500';
  };

  if (loading || !sleepData) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Moon className="h-4 w-4" />
          Slaap (Laatste Nacht)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Score</p>
            <p className={`text-2xl font-bold ${getScoreColor(sleepData.score)}`}>
              {sleepData.score}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Geslapen</p>
            <p className="text-2xl font-bold">
              {formatDuration(sleepData.duration_minutes)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Deep</p>
            <p className="text-lg font-semibold">{sleepData.deep_minutes}m</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">REM</p>
            <p className="text-lg font-semibold">{sleepData.rem_minutes}m</p>
          </div>
        </div>
        <Link to="/sleep" className="block">
          <Button variant="outline" className="w-full" size="sm">
            Bekijk Slaap
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}