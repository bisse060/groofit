import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, Calendar, Plus, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale/nl';

interface LastWorkout {
  id: string;
  date: string;
  title: string | null;
  exerciseCount: number;
  totalSets: number;
}

export default function LastWorkoutCard() {
  const { user } = useAuth();
  const [lastWorkout, setLastWorkout] = useState<LastWorkout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLastWorkout();
    }
  }, [user]);

  const loadLastWorkout = async () => {
    try {
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select('id, date, title')
        .eq('user_id', user?.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (workouts && workouts.length > 0) {
        const workout = workouts[0];

        const { data: exercises } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workout.id);

        let totalSets = 0;
        if (exercises) {
          for (const exercise of exercises) {
            const { data: sets } = await supabase
              .from('workout_sets')
              .select('id')
              .eq('workout_exercise_id', exercise.id);
            totalSets += sets?.length || 0;
          }
        }

        setLastWorkout({
          ...workout,
          exerciseCount: exercises?.length || 0,
          totalSets,
        });
      }
    } catch (error) {
      console.error('Error loading last workout:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Laatste Workout
        </h2>
        <Card>
          <CardContent className="p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-5 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!lastWorkout) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Laatste Workout
        </h2>
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Dumbbell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nog geen workouts</p>
              <Button asChild size="sm">
                <Link to="/workouts">
                  <Plus className="h-4 w-4" />
                  Start Workout
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Laatste Workout
      </h2>
      <Link to={`/workouts/${lastWorkout.id}`}>
        <Card className="card-interactive">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-secondary/10">
                  <Dumbbell className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-medium">{lastWorkout.title || 'Workout'}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(lastWorkout.date), 'd MMM yyyy', { locale: nl })}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs">
                      <span className="font-semibold text-foreground">{lastWorkout.exerciseCount}</span>
                      <span className="text-muted-foreground ml-1">oefeningen</span>
                    </span>
                    <span className="text-xs">
                      <span className="font-semibold text-foreground">{lastWorkout.totalSets}</span>
                      <span className="text-muted-foreground ml-1">sets</span>
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </section>
  );
}
