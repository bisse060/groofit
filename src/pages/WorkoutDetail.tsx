import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale/nl';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import ExercisePickerDialog from '@/components/workouts/ExercisePickerDialog';

interface WorkoutSet {
  id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  completed: boolean;
  workout_exercise_id: string;
}

interface WorkoutExercise {
  id: string;
  exercise_id: string;
  order_index: number;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    body_part: string | null;
  };
  sets: WorkoutSet[];
  lastTime?: {
    date: string;
    sets: Array<{ weight: number | null; reps: number | null; set_number: number }>;
  };
}

interface Workout {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadWorkout();
    }
  }, [user, id]);

  const loadWorkout = async () => {
    try {
      // Load workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (workoutError) throw workoutError;
      setWorkout(workoutData);

      // Load exercises and sets
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select(`
          id,
          exercise_id,
          order_index,
          notes,
          exercise:exercises(id, name, body_part)
        `)
        .eq('workout_id', id)
        .order('order_index', { ascending: true });

      if (exercisesError) throw exercisesError;

      // Load sets for each exercise
      const exercisesWithSets = await Promise.all(
        (exercisesData || []).map(async (ex: any) => {
          const { data: setsData } = await supabase
            .from('workout_sets')
            .select('*')
            .eq('workout_exercise_id', ex.id)
            .order('set_number', { ascending: true });

          // Load last time data
          const lastTime = await loadLastTime(ex.exercise_id, workoutData.date);

          return {
            ...ex,
            exercise: ex.exercise,
            sets: setsData || [],
            lastTime
          };
        })
      );

      setExercises(exercisesWithSets);
    } catch (error) {
      console.error('Error loading workout:', error);
      toast.error('Fout bij het laden van workout');
    } finally {
      setLoading(false);
    }
  };

  const loadLastTime = async (exerciseId: string, currentDate: string) => {
    try {
      const { data, error } = await supabase
        .from('workout_exercises')
        .select(`
          workout:workouts!inner(date),
          sets:workout_sets(set_number, weight, reps)
        `)
        .eq('exercise_id', exerciseId)
        .lt('workout.date', currentDate)
        .order('workout.date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return undefined;

      return {
        date: data[0].workout.date,
        sets: data[0].sets
      };
    } catch (error) {
      console.error('Error loading last time:', error);
      return undefined;
    }
  };

  const updateWorkoutTitle = async (title: string) => {
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ title })
        .eq('id', id);

      if (error) throw error;
      setWorkout(prev => prev ? { ...prev, title } : null);
    } catch (error) {
      console.error('Error updating title:', error);
      toast.error('Fout bij het updaten van titel');
    }
  };

  const finishWorkout = async () => {
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ end_time: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Workout afgerond!');
      navigate('/workouts');
    } catch (error) {
      console.error('Error finishing workout:', error);
      toast.error('Fout bij het afronden van workout');
    }
  };

  const addSet = async (workoutExerciseId: string) => {
    const exercise = exercises.find(e => e.id === workoutExerciseId);
    if (!exercise) return;

    const nextSetNumber = exercise.sets.length + 1;
    
    // Get autofill values from previous set or last time
    let weight = null;
    let reps = null;

    if (exercise.sets.length > 0) {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      weight = lastSet.weight;
      reps = lastSet.reps;
    } else if (exercise.lastTime && exercise.lastTime.sets.length > 0) {
      weight = exercise.lastTime.sets[0].weight;
      reps = exercise.lastTime.sets[0].reps;
    }

    try {
      const { data, error } = await supabase
        .from('workout_sets')
        .insert({
          workout_exercise_id: workoutExerciseId,
          set_number: nextSetNumber,
          weight,
          reps,
          completed: false
        })
        .select()
        .single();

      if (error) throw error;

      setExercises(prev =>
        prev.map(ex =>
          ex.id === workoutExerciseId
            ? { ...ex, sets: [...ex.sets, data] }
            : ex
        )
      );
    } catch (error) {
      console.error('Error adding set:', error);
      toast.error('Fout bij het toevoegen van set');
    }
  };

  const updateSet = async (setId: string, field: keyof WorkoutSet, value: any) => {
    try {
      const { error } = await supabase
        .from('workout_sets')
        .update({ [field]: value })
        .eq('id', setId);

      if (error) throw error;

      setExercises(prev =>
        prev.map(ex => ({
          ...ex,
          sets: ex.sets.map(s =>
            s.id === setId ? { ...s, [field]: value } : s
          )
        }))
      );
    } catch (error) {
      console.error('Error updating set:', error);
      toast.error('Fout bij het updaten van set');
    }
  };

  const deleteExercise = async (workoutExerciseId: string) => {
    try {
      const { error } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('id', workoutExerciseId);

      if (error) throw error;

      setExercises(prev => prev.filter(ex => ex.id !== workoutExerciseId));
      toast.success('Oefening verwijderd');
    } catch (error) {
      console.error('Error deleting exercise:', error);
      toast.error('Fout bij het verwijderen van oefening');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-4">
          <p className="text-center py-12 text-muted-foreground">Workout laden...</p>
        </div>
      </Layout>
    );
  }

  if (!workout) {
    return (
      <Layout>
        <div className="container mx-auto p-4">
          <p className="text-center py-12 text-muted-foreground">Workout niet gevonden</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/workouts')}>
            <ArrowLeft className="h-4 w-4" />
            Terug
          </Button>
          {!workout.end_time && (
            <Button onClick={finishWorkout} variant="default">
              <Check className="h-4 w-4" />
              Workout Afronden
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <Input
              value={workout.title || ''}
              onChange={(e) => updateWorkoutTitle(e.target.value)}
              className="text-2xl font-bold border-none p-0 h-auto"
              placeholder="Workout titel"
              disabled={!!workout.end_time}
            />
            <p className="text-sm text-muted-foreground">
              {format(new Date(workout.date), 'EEEE d MMMM yyyy', { locale: nl })}
            </p>
          </CardHeader>
        </Card>

        {exercises.map((exercise) => (
          <Card key={exercise.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>{exercise.exercise.name}</CardTitle>
                  {exercise.lastTime && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Vorige keer: {exercise.lastTime.sets.map((s, i) => 
                        `${s.weight || 0}kg × ${s.reps || 0}`
                      ).join(', ')}
                    </p>
                  )}
                </div>
                {!workout.end_time && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteExercise(exercise.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Set</th>
                      <th className="text-left p-2 font-semibold">Gewicht (kg)</th>
                      <th className="text-left p-2 font-semibold">Reps</th>
                      <th className="text-left p-2 font-semibold">RIR</th>
                      <th className="text-left p-2 font-semibold">Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set) => (
                      <tr key={set.id} className="border-b">
                        <td className="p-2">{set.set_number}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.5"
                            value={set.weight || ''}
                            onChange={(e) => updateSet(set.id, 'weight', parseFloat(e.target.value) || null)}
                            className="w-20"
                            disabled={!!workout.end_time}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={set.reps || ''}
                            onChange={(e) => updateSet(set.id, 'reps', parseInt(e.target.value) || null)}
                            className="w-20"
                            disabled={!!workout.end_time}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={set.rir || ''}
                            onChange={(e) => updateSet(set.id, 'rir', parseInt(e.target.value) || null)}
                            className="w-20"
                            disabled={!!workout.end_time}
                          />
                        </td>
                        <td className="p-2">
                          <Checkbox
                            checked={set.completed}
                            onCheckedChange={(checked) => updateSet(set.id, 'completed', checked)}
                            disabled={!!workout.end_time}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!workout.end_time && (
                <Button variant="outline" onClick={() => addSet(exercise.id)} className="w-full">
                  <Plus className="h-4 w-4" />
                  Set Toevoegen
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {!workout.end_time && (
          <Button
            variant="outline"
            onClick={() => setShowExercisePicker(true)}
            className="w-full"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Oefening Toevoegen
          </Button>
        )}

        <ExercisePickerDialog
          open={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          workoutId={id!}
          onExerciseAdded={loadWorkout}
        />
      </div>
    </Layout>
  );
}
