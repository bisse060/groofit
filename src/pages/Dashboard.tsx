import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Activity, TrendingUp, Target, Calendar, Camera } from 'lucide-react';
import Layout from '@/components/Layout';
import WeightTrendChart from '@/components/charts/WeightTrendChart';
import CrossDayHighlights from '@/components/dashboard/CrossDayHighlights';
import ProgressIndicator from '@/components/dashboard/ProgressIndicator';

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    todaySteps: 0,
    weekWorkouts: 0,
    currentWeight: 0,
    targetWeight: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_weight, target_weight')
        .eq('id', user?.id)
        .single();

      // Get today's log
      const today = new Date().toISOString().split('T')[0];
      const { data: todayLog } = await supabase
        .from('daily_logs')
        .select('steps')
        .eq('user_id', user?.id)
        .eq('log_date', today)
        .maybeSingle();

      // Get this week's workouts
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekLogs } = await supabase
        .from('daily_logs')
        .select('workout_completed')
        .eq('user_id', user?.id)
        .eq('workout_completed', true)
        .gte('log_date', weekAgo.toISOString().split('T')[0]);

      setStats({
        todaySteps: todayLog?.steps || 0,
        weekWorkouts: weekLogs?.length || 0,
        currentWeight: profile?.current_weight || 0,
        targetWeight: profile?.target_weight || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Today's Steps",
      value: stats.todaySteps.toLocaleString(),
      icon: Activity,
      color: 'text-primary',
    },
    {
      title: 'Weekly Workouts',
      value: stats.weekWorkouts,
      icon: Calendar,
      color: 'text-secondary',
    },
    {
      title: 'Current Weight',
      value: stats.currentWeight ? `${stats.currentWeight} kg` : '-',
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      title: 'Target Weight',
      value: stats.targetWeight ? `${stats.targetWeight} kg` : '-',
      icon: Target,
      color: 'text-accent',
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p>{t('common.loading')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('nav.dashboard')}</h1>
          <p className="text-muted-foreground">Welcome back! Here's your fitness overview.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <WeightTrendChart />
          <ProgressIndicator />
        </div>

        <CrossDayHighlights />

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link to="/daily-logs">
                <Card className="bg-muted hover:bg-muted/80 cursor-pointer transition-colors">
                  <CardContent className="pt-6 text-center">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="font-semibold">Log Today's Activity</p>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/measurements">
                <Card className="bg-muted hover:bg-muted/80 cursor-pointer transition-colors">
                  <CardContent className="pt-6 text-center">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-secondary" />
                    <p className="font-semibold">Add Measurement</p>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/measurements">
                <Card className="bg-muted hover:bg-muted/80 cursor-pointer transition-colors">
                  <CardContent className="pt-6 text-center">
                    <Camera className="h-8 w-8 mx-auto mb-2 text-success" />
                    <p className="font-semibold">Add Measurement with Photos</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
