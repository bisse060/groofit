import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import ExercisePickerDialog from '@/components/workouts/ExercisePickerDialog';

interface RoutineExercise {
  id: string;
  exercise_id: string;
  order_index: number;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    body_part: string | null;
  };
}

export default function RoutineEditor() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(id || null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user && id) {
      loadRoutine();
    }
  }, [user, authLoading, id]);

  const loadRoutine = async () => {
    try {
      const { data: routine, error } = await supabase
        .from('workouts')
        .select('id, title')
        .eq('id', id)
        .eq('user_id', user?.id)
        .eq('is_template', true)
        .single();

      if (error) throw error;
      setTitle(routine.title || '');
      setRoutineId(routine.id);

      const { data: exercisesData, error: exError } = await supabase
        .from('workout_exercises')
        .select(`
          id, exercise_id, order_index, notes,
          exercise:exercises(id, name, body_part)
        `)
        .eq('workout_id', id)
        .order('order_index', { ascending: true });

      if (exError) throw exError;
      setExercises((exercisesData as any) || []);
    } catch (error) {
      console.error('Error loading routine:', error);
      toast.error('Routine niet gevonden');
      navigate('/workouts');
    } finally {
      setLoading(false);
    }
  };

  const ensureRoutineExists = async (): Promise<string> => {
    if (routineId) return routineId;

    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user?.id,
        date: new Date().toISOString().split('T')[0],
        title: title || 'Nieuwe Routine',
        is_template: true,
      })
      .select()
      .single();

    if (error) throw error;
    setRoutineId(data.id);
    // Update URL without full navigation
    window.history.replaceState(null, '', `/routines/${data.id}`);
    return data.id;
  };

  const saveTitle = async () => {
    if (!routineId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ title })
        .eq('id', routineId);
      if (error) throw error;
    } catch (error) {
      toast.error('Fout bij opslaan titel');
    } finally {
      setSaving(false);
    }
  };

  const handleExerciseAdded = async () => {
    if (!routineId) return;
    // Reload exercises
    const { data, error } = await supabase
      .from('workout_exercises')
      .select(`
        id, exercise_id, order_index, notes,
        exercise:exercises(id, name, body_part)
      `)
      .eq('workout_id', routineId)
      .order('order_index', { ascending: true });

    if (!error) setExercises((data as any) || []);
  };

  const deleteExercise = async (exerciseId: string) => {
    try {
      const { error } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('id', exerciseId);
      if (error) throw error;
      setExercises(prev => prev.filter(e => e.id !== exerciseId));
      toast.success('Oefening verwijderd');
    } catch (error) {
      toast.error('Fout bij verwijderen');
    }
  };

  const handleAddExercise = async () => {
    try {
      await ensureRoutineExists();
      setShowExercisePicker(true);
    } catch (error) {
      toast.error('Fout bij aanmaken routine');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Geef de routine een naam');
      return;
    }

    setSaving(true);
    try {
      if (!routineId) {
        await ensureRoutineExists();
      } else {
        await saveTitle();
      }
      toast.success('Routine opgeslagen');
      navigate('/workouts');
    } catch (error) {
      toast.error('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <p className="text-center py-8 text-sm text-muted-foreground">Laden...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/workouts')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Terug
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            Opslaan
          </Button>
        </div>

        {/* Title */}
        <Card>
          <CardContent className="p-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className="text-lg font-semibold border-none p-0 h-auto bg-transparent"
              placeholder="Routine naam..."
            />
            <p className="text-xs text-muted-foreground mt-0.5">
              {exercises.length} oefening{exercises.length !== 1 ? 'en' : ''}
            </p>
          </CardContent>
        </Card>

        {/* Exercises */}
        {exercises.map((exercise) => (
          <Card key={exercise.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{exercise.exercise.name}</p>
                    {exercise.exercise.body_part && (
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {exercise.exercise.body_part}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => deleteExercise(exercise.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Exercise */}
        <Button
          variant="outline"
          onClick={handleAddExercise}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Oefening Toevoegen
        </Button>

        <div className="bottom-nav-spacer" />
      </div>

      {routineId && (
        <ExercisePickerDialog
          open={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          workoutId={routineId}
          onExerciseAdded={handleExerciseAdded}
        />
      )}
    </Layout>
  );
}
