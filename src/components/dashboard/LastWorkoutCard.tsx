import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, Calendar, Plus } from 'lucide-react';
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

        // Count exercises and sets
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
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Workout laden...</p>
        </CardContent>
      </Card>
    );
  }

  if (!lastWorkout) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Laatste Workout
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center space-y-3">
            <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">Nog geen workouts gelogd</p>
            <Link to="/workouts">
              <Button>
                <Plus className="h-4 w-4" />
                Start Workout
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5" />
          Laatste Workout
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{lastWorkout.title || 'Workout'}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="h-4 w-4" />
            {format(new Date(lastWorkout.date), 'd MMMM yyyy', { locale: nl })}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{lastWorkout.exerciseCount}</p>
            <p className="text-sm text-muted-foreground">Oefeningen</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{lastWorkout.totalSets}</p>
            <p className="text-sm text-muted-foreground">Sets</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link to={`/workouts/${lastWorkout.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              Bekijk Workout
            </Button>
          </Link>
          <Link to="/workouts" className="flex-1">
            <Button className="w-full">
              <Plus className="h-4 w-4" />
              Nieuwe Workout
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
