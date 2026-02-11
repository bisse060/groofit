import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Plus, Calendar, Clock, Star, Copy, Trash2, Weight, Pencil } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { nl } from 'date-fns/locale/nl';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface WorkoutWithStats {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  rating: number | null;
  photo_url: string | null;
  is_template: boolean;
  total_sets?: number;
  total_volume?: number;
  exercise_count?: number;
}

export default function Workouts() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<WorkoutWithStats[]>([]);
  const [templates, setTemplates] = useState<WorkoutWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    try {
      // Load recent workouts (non-templates)
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('id, date, title, start_time, end_time, rating, photo_url, is_template')
        .eq('user_id', user?.id)
        .eq('is_template', false)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (workoutError) throw workoutError;

      // Auto-close workouts older than 10 hours
      const staleWorkouts = (workoutData || []).filter(w => {
        if (w.end_time || !w.start_time) return false;
        const hoursSinceStart = differenceInMinutes(new Date(), new Date(w.start_time)) / 60;
        return hoursSinceStart >= 10;
      });

      for (const sw of staleWorkouts) {
        const autoEndTime = new Date(new Date(sw.start_time!).getTime() + 10 * 60 * 60 * 1000).toISOString();
        await supabase.from('workouts').update({ end_time: autoEndTime }).eq('id', sw.id);
        sw.end_time = autoEndTime;
      }

      // Load stats for recent workouts
      const workoutsWithStats = await Promise.all(
        (workoutData || []).map(async (w) => {
          const { data: exercises } = await supabase
            .from('workout_exercises')
            .select('id')
            .eq('workout_id', w.id);

          let totalSets = 0;
          let totalVolume = 0;

          if (exercises && exercises.length > 0) {
            const { data: sets } = await supabase
              .from('workout_sets')
              .select('weight, reps, completed')
              .in('workout_exercise_id', exercises.map(e => e.id));

            if (sets) {
              totalSets = sets.filter(s => s.completed).length;
              totalVolume = sets
                .filter(s => s.completed && s.weight && s.reps)
                .reduce((sum, s) => sum + (s.weight! * s.reps!), 0);
            }
          }

          return {
            ...w,
            total_sets: totalSets,
            total_volume: totalVolume,
            exercise_count: exercises?.length || 0,
          };
        })
      );

      setWorkouts(workoutsWithStats);

      // Load templates
      const { data: templateData, error: templateError } = await supabase
        .from('workouts')
        .select('id, date, title, start_time, end_time, rating, photo_url, is_template')
        .eq('user_id', user?.id)
        .eq('is_template', true)
        .order('title', { ascending: true });

      if (templateError) throw templateError;

      const templatesWithStats = await Promise.all(
        (templateData || []).map(async (t) => {
          const { data: exercises } = await supabase
            .from('workout_exercises')
            .select('id')
            .eq('workout_id', t.id);

          return { ...t, exercise_count: exercises?.length || 0 };
        })
      );

      setTemplates(templatesWithStats);
    } catch (error) {
      console.error('Error loading workouts:', error);
      toast.error('Fout bij het laden van workouts');
    } finally {
      setLoading(false);
    }
  };

  const createNewWorkout = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: user?.id,
          date: new Date().toISOString().split('T')[0],
          start_time: new Date().toISOString(),
          title: 'Workout',
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Nieuwe workout gestart');
      navigate(`/workouts/${data.id}`);
    } catch (error) {
      console.error('Error creating workout:', error);
      toast.error('Fout bij het aanmaken van workout');
    }
  };

  const startFromTemplate = async (templateId: string) => {
    try {
      // Get template info
      const template = templates.find(t => t.id === templateId);

      // Create new workout
      const { data: newWorkout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          user_id: user?.id,
          date: new Date().toISOString().split('T')[0],
          start_time: new Date().toISOString(),
          title: template?.title || 'Workout',
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      // Copy exercises from template
      const { data: templateExercises } = await supabase
        .from('workout_exercises')
        .select('exercise_id, order_index, notes')
        .eq('workout_id', templateId)
        .order('order_index', { ascending: true });

      if (templateExercises && templateExercises.length > 0) {
        const exerciseInserts = templateExercises.map(te => ({
          workout_id: newWorkout.id,
          exercise_id: te.exercise_id,
          order_index: te.order_index,
          notes: te.notes,
        }));

        const { data: newExercises, error: exError } = await supabase
          .from('workout_exercises')
          .insert(exerciseInserts)
          .select();

        if (exError) throw exError;

        // For each template exercise, copy sets from last workout with this exercise
        if (newExercises) {
          for (const newEx of newExercises) {
            const { data: lastSets } = await supabase
              .from('workout_exercises')
              .select(`
                sets:workout_sets(set_number, weight, reps, rir, is_warmup)
              `)
              .eq('exercise_id', newEx.exercise_id)
              .neq('workout_id', templateId)
              .order('created_at', { ascending: false })
              .limit(1);

            if (lastSets && lastSets.length > 0 && lastSets[0].sets.length > 0) {
              const setInserts = lastSets[0].sets.map((s: any) => ({
                workout_exercise_id: newEx.id,
                set_number: s.set_number,
                weight: s.weight,
                reps: s.reps,
                rir: s.rir,
                is_warmup: s.is_warmup,
                completed: false,
              }));

              await supabase.from('workout_sets').insert(setInserts);
            }
          }
        }
      }

      toast.success('Workout gestart vanuit template');
      navigate(`/workouts/${newWorkout.id}`);
    } catch (error) {
      console.error('Error starting from template:', error);
      toast.error('Fout bij het starten van workout');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase.from('workouts').delete().eq('id', templateId);
      if (error) throw error;
      toast.success('Template verwijderd');
      loadData();
    } catch (error) {
      toast.error('Fout bij verwijderen');
    }
  };

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    return differenceInMinutes(new Date(end), new Date(start));
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`h-3 w-3 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
        ))}
      </div>
    );
  };

  const recentFinished = workouts.filter(w => w.end_time).slice(0, 5);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Workouts</h1>
          </div>
          <Button onClick={createNewWorkout} size="sm" className="self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-1" />
            Nieuwe Workout
          </Button>
        </div>

        {/* Templates */}
        {templates.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Routines</h2>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => navigate('/routines/new')}>
                <Plus className="h-3 w-3 mr-1" />
                Nieuw
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map(template => (
                <Card key={template.id} className="card-interactive">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{template.title || 'Routine'}</p>
                        <p className="text-xs text-muted-foreground">{template.exercise_count} oefeningen</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" onClick={() => startFromTemplate(template.id)} className="h-7 text-xs px-2">
                          <Plus className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/routines/${template.id}`)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Template verwijderen?</AlertDialogTitle>
                              <AlertDialogDescription>Dit kan niet ongedaan worden.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuleer</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTemplate(template.id)}>Verwijder</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-2">
            <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Routines</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/routines/new')} className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              Nieuwe Routine
            </Button>
          </section>
        )}

        {/* Recent Summary */}
        {recentFinished.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Laatste trainingen</h2>
            <div className="grid gap-2">
              {recentFinished.map(w => {
                const duration = getDuration(w.start_time, w.end_time);
                return (
                  <Card key={w.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/workouts/${w.id}`)}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{w.title || 'Workout'}</p>
                            {renderStars(w.rating)}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(w.date), 'd MMM', { locale: nl })}
                            </span>
                            {duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {duration} min
                              </span>
                            )}
                            <span>{w.exercise_count} oef</span>
                            <span>{w.total_sets} sets</span>
                          </div>
                        </div>
                        {w.total_volume != null && w.total_volume > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{Math.round(w.total_volume).toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">kg volume</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* All Workouts */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Alle workouts</h2>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Workouts laden...</p>
            </div>
          ) : workouts.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center space-y-3">
                  <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-medium mb-1">Nog geen workouts</p>
                    <p className="text-xs text-muted-foreground mb-3">Start je eerste workout</p>
                    <Button size="sm" onClick={createNewWorkout}>
                      <Plus className="h-4 w-4 mr-1" />
                      Start Workout
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {workouts.map((workout) => {
                const duration = getDuration(workout.start_time, workout.end_time);
                return (
                  <Card
                    key={workout.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => navigate(`/workouts/${workout.id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{workout.title || 'Workout'}</p>
                            {!workout.end_time && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Actief</Badge>
                            )}
                            {renderStars(workout.rating)}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>{format(new Date(workout.date), 'd MMM yyyy', { locale: nl })}</span>
                            {duration && <span>{duration} min</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <div className="bottom-nav-spacer" />
      </div>
    </Layout>
  );
}
