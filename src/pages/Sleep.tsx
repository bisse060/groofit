import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Moon, Clock, Zap, TrendingUp } from 'lucide-react';
import Layout from '@/components/Layout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface SleepLog {
  id: string;
  date: string;
  duration_minutes: number;
  efficiency: number;
  score: number;
  deep_minutes: number;
  rem_minutes: number;
  light_minutes: number;
  wake_minutes: number;
  start_time: string;
  end_time: string;
}

export default function Sleep() {
  const { user } = useAuth();
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [latestSleep, setLatestSleep] = useState<SleepLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSleepData();
    }
  }, [user]);

  const loadSleepData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      setSleepLogs(data || []);
      setLatestSleep(data?.[0] || null);
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

  const chartData = sleepLogs
    .slice(0, 14)
    .reverse()
    .map(log => ({
      date: format(new Date(log.date), 'dd/MM'),
      'Duur (uur)': (log.duration_minutes / 60).toFixed(1),
      'Score': log.score,
      'Deep': log.deep_minutes,
      'REM': log.rem_minutes,
      'Light': log.light_minutes,
      'Wake': log.wake_minutes,
    }));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p>Laden...</p>
        </div>
      </Layout>
    );
  }

  if (!latestSleep) {
    return (
      <Layout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Slaap Tracking</h1>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                Geen slaapdata beschikbaar. Sync je Fitbit om slaapdata te bekijken.
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
        <div>
          <h1 className="text-3xl font-bold">Slaap Tracking</h1>
          <p className="text-muted-foreground">Jouw slaapoverzicht en trends</p>
        </div>

        {/* Latest Night Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Laatste Nacht ({format(new Date(latestSleep.date), 'dd MMMM yyyy')})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(latestSleep.score)}`}>
                  {latestSleep.score}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Slaap Score</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold">
                  {formatDuration(latestSleep.duration_minutes)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Totale Duur</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold">
                  {latestSleep.efficiency}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">Efficiëntie</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sleep Phases */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Moon className="h-4 w-4 text-blue-500" />
                Diepe Slaap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestSleep.deep_minutes}m</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                REM Slaap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestSleep.rem_minutes}m</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Moon className="h-4 w-4 text-cyan-500" />
                Lichte Slaap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestSleep.light_minutes}m</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Wakker
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestSleep.wake_minutes}m</div>
            </CardContent>
          </Card>
        </div>

        {/* Duration Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Slaapduur Trend (Laatste 14 Dagen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Duur (uur)" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sleep Phases Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Slaapfases Verdeling (Laatste 14 Dagen)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Deep" stackId="a" fill="#3b82f6" />
                <Bar dataKey="REM" stackId="a" fill="#a855f7" />
                <Bar dataKey="Light" stackId="a" fill="#06b6d4" />
                <Bar dataKey="Wake" stackId="a" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}