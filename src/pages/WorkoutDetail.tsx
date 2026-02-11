import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Check, Clock, Instagram, Share2 } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { nl } from 'date-fns/locale/nl';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import ExercisePickerDialog from '@/components/workouts/ExercisePickerDialog';
import FinishWorkoutDialog from '@/components/workouts/FinishWorkoutDialog';

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
  rating: number | null;
  photo_url: string | null;
}

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (user && id) {
      loadWorkout();
    }
  }, [user, id]);

  // Live timer for active workouts
  useEffect(() => {
    if (!workout?.start_time || workout?.end_time) return;
    const interval = setInterval(() => {
      setElapsed(differenceInMinutes(new Date(), new Date(workout.start_time!)));
    }, 30000);
    setElapsed(differenceInMinutes(new Date(), new Date(workout.start_time!)));
    return () => clearInterval(interval);
  }, [workout?.start_time, workout?.end_time]);

  const loadWorkout = async () => {
    try {
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('id, date, title, start_time, end_time, notes, rating, photo_url')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (workoutError) throw workoutError;
      setWorkout(workoutData);

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

      const exercisesWithSets = await Promise.all(
        (exercisesData || []).map(async (ex: any) => {
          const { data: setsData } = await supabase
            .from('workout_sets')
            .select('*')
            .eq('workout_exercise_id', ex.id)
            .order('set_number', { ascending: true });

          const lastTime = await loadLastTime(ex.exercise_id, workoutData.date);

          return { ...ex, exercise: ex.exercise, sets: setsData || [], lastTime };
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
      return { date: data[0].workout.date, sets: data[0].sets };
    } catch (error) {
      return undefined;
    }
  };

  const updateWorkoutTitle = async (title: string) => {
    try {
      const { error } = await supabase.from('workouts').update({ title }).eq('id', id);
      if (error) throw error;
      setWorkout(prev => prev ? { ...prev, title } : null);
    } catch (error) {
      toast.error('Fout bij het updaten van titel');
    }
  };

  const handleFinishWorkout = async (data: { rating: number; notes: string; photo: File | null; saveAsTemplate: boolean }) => {
    try {
      let photoUrl: string | null = null;

      // Upload photo if provided
      if (data.photo) {
        const fileExt = data.photo.name.split('.').pop();
        const fileName = `${user?.id}/${id}/workout.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('workout-photos')
          .upload(fileName, data.photo, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('workout-photos').getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }

      // Update workout
      const { error } = await supabase
        .from('workouts')
        .update({
          end_time: new Date().toISOString(),
          rating: data.rating || null,
          notes: data.notes || workout?.notes,
          photo_url: photoUrl,
        })
        .eq('id', id);

      if (error) throw error;

      // Save as template if requested
      if (data.saveAsTemplate) {
        const { data: templateData, error: templateError } = await supabase
          .from('workouts')
          .insert({
            user_id: user?.id,
            date: new Date().toISOString().split('T')[0],
            title: workout?.title || 'Routine',
            is_template: true,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        // Copy exercises to template
        const exerciseInserts = exercises.map(ex => ({
          workout_id: templateData.id,
          exercise_id: ex.exercise_id,
          order_index: ex.order_index,
          notes: ex.notes,
        }));

        if (exerciseInserts.length > 0) {
          await supabase.from('workout_exercises').insert(exerciseInserts);
        }

        toast.success('Routine opgeslagen!');
      }

      toast.success('Workout afgerond! 💪');
      navigate('/workouts');
    } catch (error) {
      console.error('Error finishing workout:', error);
      toast.error('Fout bij het afronden');
    }
  };

  const addSet = async (workoutExerciseId: string) => {
    const exercise = exercises.find(e => e.id === workoutExerciseId);
    if (!exercise) return;

    const nextSetNumber = exercise.sets.length + 1;
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
        .insert({ workout_exercise_id: workoutExerciseId, set_number: nextSetNumber, weight, reps, completed: false })
        .select()
        .single();

      if (error) throw error;
      setExercises(prev => prev.map(ex => ex.id === workoutExerciseId ? { ...ex, sets: [...ex.sets, data] } : ex));
    } catch (error) {
      toast.error('Fout bij het toevoegen van set');
    }
  };

  const updateSet = async (setId: string, field: keyof WorkoutSet, value: any) => {
    try {
      const { error } = await supabase.from('workout_sets').update({ [field]: value }).eq('id', setId);
      if (error) throw error;
      setExercises(prev => prev.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
      })));
    } catch (error) {
      toast.error('Fout bij het updaten van set');
    }
  };

  const deleteExercise = async (workoutExerciseId: string) => {
    try {
      const { error } = await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId);
      if (error) throw error;
      setExercises(prev => prev.filter(ex => ex.id !== workoutExerciseId));
      toast.success('Oefening verwijderd');
    } catch (error) {
      toast.error('Fout bij het verwijderen');
    }
  };

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  const totalVolume = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed && s.weight && s.reps).reduce((s, set) => s + (set.weight! * set.reps!), 0), 0);

  const handleShareInstagram = () => {
    if (workout?.photo_url) {
      // Open Instagram with deep link or web
      const instagramUrl = `https://www.instagram.com/`;
      window.open(instagramUrl, '_blank');
      toast.info('Download de foto en deel deze op Instagram!');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4">
          <p className="text-center py-8 text-sm text-muted-foreground">Workout laden...</p>
        </div>
      </Layout>
    );
  }

  if (!workout) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4">
          <p className="text-center py-8 text-sm text-muted-foreground">Workout niet gevonden</p>
        </div>
      </Layout>
    );
  }

  const isActive = !workout.end_time;
  const duration = workout.end_time && workout.start_time
    ? differenceInMinutes(new Date(workout.end_time), new Date(workout.start_time))
    : elapsed;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/workouts')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Terug
          </Button>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge variant="secondary" className="gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {duration} min
              </Badge>
            )}
            {isActive && (
              <Button onClick={() => setShowFinishDialog(true)} size="sm">
                <Check className="h-4 w-4 mr-1" />
                Afronden
              </Button>
            )}
          </div>
        </div>

        {/* Workout Info */}
        <Card>
          <CardContent className="p-3">
            <Input
              value={workout.title || ''}
              onChange={(e) => updateWorkoutTitle(e.target.value)}
              className="text-lg font-semibold border-none p-0 h-auto bg-transparent"
              placeholder="Workout titel"
              disabled={!isActive}
            />
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(workout.date), 'EEEE d MMMM yyyy', { locale: nl })}
              {!isActive && duration > 0 && ` • ${duration} min`}
            </p>

            {/* Completed workout summary */}
            {!isActive && (
              <div className="flex items-center gap-4 mt-2 pt-2 border-t text-xs text-muted-foreground">
                <span>{exercises.length} oefeningen</span>
                <span>{totalSets} sets</span>
                {totalVolume > 0 && <span>{Math.round(totalVolume).toLocaleString()} kg volume</span>}
                {workout.rating && (
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <span key={i} className={i <= workout.rating! ? 'text-yellow-400' : 'text-muted-foreground/30'}>★</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Workout photo */}
            {workout.photo_url && (
              <div className="mt-2">
                <img src={workout.photo_url} alt="Workout" className="w-full max-h-48 object-cover rounded-lg" />
                <Button variant="outline" size="sm" className="mt-1 gap-1 text-xs" onClick={handleShareInstagram}>
                  <Instagram className="h-3 w-3" />
                  Deel op Instagram
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exercises */}
        {exercises.map((exercise) => (
          <Card key={exercise.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-sm">{exercise.exercise.name}</CardTitle>
                  {exercise.lastTime && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Vorige: {exercise.lastTime.sets.map(s => `${s.weight || 0}×${s.reps || 0}`).join(', ')}
                    </p>
                  )}
                </div>
                {isActive && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteExercise(exercise.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1.5 text-xs font-medium text-muted-foreground">Set</th>
                      <th className="text-left p-1.5 text-xs font-medium text-muted-foreground">Kg</th>
                      <th className="text-left p-1.5 text-xs font-medium text-muted-foreground">Reps</th>
                      <th className="text-left p-1.5 text-xs font-medium text-muted-foreground">RIR</th>
                      <th className="text-center p-1.5 text-xs font-medium text-muted-foreground">✓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set) => (
                      <tr key={set.id} className={`border-b last:border-0 ${set.completed ? 'bg-success/5' : ''}`}>
                        <td className="p-1.5 text-xs text-muted-foreground">{set.set_number}</td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            step="0.5"
                            value={set.weight ?? ''}
                            onChange={(e) => updateSet(set.id, 'weight', parseFloat(e.target.value) || null)}
                            className="w-16 h-7 text-sm"
                            disabled={!isActive}
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            value={set.reps ?? ''}
                            onChange={(e) => updateSet(set.id, 'reps', parseInt(e.target.value) || null)}
                            className="w-14 h-7 text-sm"
                            disabled={!isActive}
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            value={set.rir ?? ''}
                            onChange={(e) => updateSet(set.id, 'rir', parseInt(e.target.value) || null)}
                            className="w-14 h-7 text-sm"
                            disabled={!isActive}
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <Checkbox
                            checked={set.completed}
                            onCheckedChange={(checked) => updateSet(set.id, 'completed', checked)}
                            disabled={!isActive}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isActive && (
                <Button variant="outline" onClick={() => addSet(exercise.id)} className="w-full h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Set Toevoegen
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {isActive && (
          <Button
            variant="outline"
            onClick={() => setShowExercisePicker(true)}
            className="w-full"
            size="default"
          >
            <Plus className="h-4 w-4 mr-1" />
            Oefening Toevoegen
          </Button>
        )}

        <ExercisePickerDialog
          open={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          workoutId={id!}
          onExerciseAdded={loadWorkout}
        />

        <FinishWorkoutDialog
          open={showFinishDialog}
          onClose={() => setShowFinishDialog(false)}
          onFinish={handleFinishWorkout}
          startTime={workout.start_time}
          workoutTitle={workout.title}
          totalSets={totalSets}
          totalVolume={totalVolume}
          exerciseCount={exercises.length}
        />

        <div className="bottom-nav-spacer" />
      </div>
    </Layout>
  );
}
