import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { SleepSummaryCard } from '@/components/sleep/SleepSummaryCard';
import { SleepDurationChart } from '@/components/sleep/SleepDurationChart';
import { SleepPhasesChart } from '@/components/sleep/SleepPhasesChart';
import { useNavigate } from 'react-router-dom';

interface SleepLog {
  id: string;
  date: string;
  duration_minutes: number | null;
  efficiency: number | null;
  score: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  wake_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
}

export default function Sleep() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      loadSleepLogs();
    }
  }, [user, authLoading, navigate]);

  const loadSleepLogs = async () => {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading sleep logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const latest = useMemo(() => {
    return logs.length
      ? [...logs].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0]
      : null;
  }, [logs]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p>Laden...</p>
        </div>
      </Layout>
    );
  }

  if (!latest) {
    return (
      <Layout>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">Slaapoverzicht</h1>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                Nog geen slaapdata. Sync je Fitbit om te beginnen.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Slaapoverzicht</h1>

        <SleepSummaryCard log={latest} />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Slaapduur laatste 90 dagen</CardTitle>
            </CardHeader>
            <CardContent>
              <SleepDurationChart logs={logs} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slaapfasen laatste 90 dagen</CardTitle>
            </CardHeader>
            <CardContent>
              <SleepPhasesChart logs={logs} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}