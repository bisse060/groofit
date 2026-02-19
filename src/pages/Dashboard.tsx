import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Footprints, Dumbbell, Scale, Target, Plus, Moon, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays, addDays, isToday } from 'date-fns';
import { nl } from 'date-fns/locale/nl';
import Layout from '@/components/Layout';
import WeightTrendChart from '@/components/charts/WeightTrendChart';
import CrossDayHighlights from '@/components/dashboard/CrossDayHighlights';
import ProgressIndicator from '@/components/dashboard/ProgressIndicator';
import SleepSummaryCard from '@/components/dashboard/SleepSummaryCard';
import FitbitAnalysisTabs from '@/components/dashboard/FitbitAnalysisTabs';
import LastWorkoutCard from '@/components/dashboard/LastWorkoutCard';
import CoachInsightCard from '@/components/dashboard/CoachInsightCard';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState({
    todaySteps: 0,
    weekWorkouts: 0,
    currentWeight: 0,
    targetWeight: 0,
  });
  const [loading, setLoading] = useState(true);

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      loadDashboardData();
    }
  }, [user, authLoading, navigate, selectedDate]);

  const loadDashboardData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_weight, target_weight')
        .eq('id', user?.id)
        .single();

      const dateStr = formatDateString(selectedDate);
      const { data: todayLog } = await supabase
        .from('daily_logs')
        .select('steps')
        .eq('user_id', user?.id)
        .eq('log_date', dateStr)
        .maybeSingle();

      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - 7);
      const { data: weekLogs } = await supabase
        .from('daily_logs')
        .select('workout_completed')
        .eq('user_id', user?.id)
        .eq('workout_completed', true)
        .gte('log_date', formatDateString(weekStart))
        .lte('log_date', dateStr);

      // Get current weight: prioritize Fitbit, then measurements, then profile
      let currentWeight = profile?.current_weight || 0;

      // Try Fitbit weight first
      const { data: fitbitWeight } = await supabase
        .from('daily_logs')
        .select('weight')
        .eq('user_id', user?.id)
        .eq('synced_from_fitbit', true)
        .not('weight', 'is', null)
        .order('log_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fitbitWeight?.weight) {
        currentWeight = Number(fitbitWeight.weight);
      } else {
        // Try measurements
        const { data: latestMeasurement } = await supabase
          .from('measurements')
          .select('weight')
          .eq('user_id', user?.id)
          .not('weight', 'is', null)
          .order('measurement_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMeasurement?.weight) {
          currentWeight = Number(latestMeasurement.weight);
        }
      }

      setStats({
        todaySteps: todayLog?.steps || 0,
        weekWorkouts: weekLogs?.length || 0,
        currentWeight,
        targetWeight: profile?.target_weight || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse space-y-4 w-full max-w-md">
            <div className="h-8 bg-muted rounded-lg w-1/3"></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 bg-muted rounded-xl"></div>
              <div className="h-24 bg-muted rounded-xl"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('nav.dashboard')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Je fitness overzicht</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isToday(selectedDate) ? "secondary" : "outline"}
              size="sm"
              className="text-xs h-8 min-w-[100px]"
              onClick={() => setSelectedDate(new Date())}
            >
              {isToday(selectedDate) ? 'Vandaag' : format(selectedDate, 'd MMM yyyy', { locale: nl })}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedDate(d => addDays(d, 1))}
              disabled={isToday(selectedDate)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* AI Coach Insight */}
        <CoachInsightCard />

        {/* Today Overview - Primary Stats */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{isToday(selectedDate) ? 'Vandaag' : format(selectedDate, 'd MMMM', { locale: nl })}</h2>
          <div className="grid grid-cols-2 gap-2">
            {/* Steps */}
            <Card className="card-interactive">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Stappen</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {stats.todaySteps.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Footprints className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Workouts */}
            <Card className="card-interactive">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Workouts (7d)</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {stats.weekWorkouts}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <Dumbbell className="h-4 w-4 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Weight */}
            <Card className="card-interactive">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Huidig gewicht</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {stats.currentWeight ? `${stats.currentWeight}` : '-'}
                      {stats.currentWeight > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-success/10">
                    <Scale className="h-4 w-4 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Weight */}
            <Card className="card-interactive">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Doelgewicht</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {stats.targetWeight ? `${stats.targetWeight}` : '-'}
                      {stats.targetWeight > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Target className="h-4 w-4 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Snelle acties</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <Button asChild variant="outline" size="sm" className="flex-shrink-0 gap-2">
              <Link to="/workouts">
                <Plus className="h-4 w-4" />
                <span>Workout</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-shrink-0 gap-2">
              <Link to="/measurements">
                <Scale className="h-4 w-4" />
                <span>Meting</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-shrink-0 gap-2">
              <Link to="/sleep">
                <Moon className="h-4 w-4" />
                <span>Slaap</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-shrink-0 gap-2">
              <Link to="/comparisons">
                <Camera className="h-4 w-4" />
                <span>Foto's</span>
              </Link>
            </Button>
          </div>
        </section>

        {/* Progress Section */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Voortgang</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <WeightTrendChart />
            <ProgressIndicator />
            <SleepSummaryCard />
          </div>
        </section>

        {/* Last Workout */}
        <LastWorkoutCard />

        {/* Fitbit Analysis (Sleep + Health) */}
        <FitbitAnalysisTabs />

        {/* Weekly/Monthly Highlights */}
        <CrossDayHighlights />

        {/* Bottom spacer for mobile nav */}
        <div className="bottom-nav-spacer" />
      </div>
    </Layout>
  );
}
