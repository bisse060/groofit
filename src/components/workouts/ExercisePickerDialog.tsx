import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Star, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Exercise {
  id: string;
  name: string;
  body_part: string | null;
  is_favorite: boolean;
}

interface ExercisePickerDialogProps {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  onExerciseAdded: () => void;
}

export default function ExercisePickerDialog({
  open,
  onClose,
  workoutId,
  onExerciseAdded,
}: ExercisePickerDialogProps) {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadExercises();
    }
  }, [open, user, searchQuery]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error('Error loading exercises:', error);
      toast.error('Fout bij het laden van oefeningen');
    } finally {
      setLoading(false);
    }
  };

  const createAndAddExercise = async (name: string) => {
    if (!name.trim()) return;

    try {
      // Check if exercise already exists
      const { data: existing } = await supabase
        .from('exercises')
        .select('id')
        .eq('user_id', user?.id)
        .eq('name', name.trim())
        .maybeSingle();

      let exerciseId = existing?.id;

      if (!exerciseId) {
        // Create new exercise
        const { data: newExercise, error: createError } = await supabase
          .from('exercises')
          .insert({
            user_id: user?.id,
            name: name.trim(),
          })
          .select()
          .single();

        if (createError) throw createError;
        exerciseId = newExercise.id;
        toast.success('Nieuwe oefening aangemaakt');
      }

      // Add exercise to workout
      await addExerciseToWorkout(exerciseId);
    } catch (error) {
      console.error('Error creating exercise:', error);
      toast.error('Fout bij het aanmaken van oefening');
    }
  };

  const addExerciseToWorkout = async (exerciseId: string) => {
    try {
      // Get current max order_index
      const { data: existingExercises } = await supabase
        .from('workout_exercises')
        .select('order_index')
        .eq('workout_id', workoutId)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrderIndex = existingExercises && existingExercises.length > 0
        ? existingExercises[0].order_index + 1
        : 0;

      const { error } = await supabase
        .from('workout_exercises')
        .insert({
          workout_id: workoutId,
          exercise_id: exerciseId,
          order_index: nextOrderIndex,
        });

      if (error) throw error;

      toast.success('Oefening toegevoegd aan workout');
      onExerciseAdded();
      onClose();
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding exercise to workout:', error);
      toast.error('Fout bij het toevoegen van oefening');
    }
  };

  const toggleFavorite = async (exerciseId: string, currentFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('exercises')
        .update({ is_favorite: !currentFavorite })
        .eq('id', exerciseId);

      if (error) throw error;

      setExercises(prev =>
        prev.map(ex =>
          ex.id === exerciseId ? { ...ex, is_favorite: !currentFavorite } : ex
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Fout bij het updaten van favoriet');
    }
  };

  const favorites = exercises.filter(ex => ex.is_favorite);
  const nonFavorites = exercises.filter(ex => !ex.is_favorite);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Oefening Toevoegen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek of maak nieuwe oefening..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchQuery && exercises.length === 0 && !loading && (
            <Button
              onClick={() => createAndAddExercise(searchQuery)}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              Maak "{searchQuery}" aan en voeg toe
            </Button>
          )}

          {favorites.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                Favorieten
              </h3>
              <div className="space-y-2">
                {favorites.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => addExerciseToWorkout(exercise.id)}
                  >
                    <div>
                      <p className="font-medium">{exercise.name}</p>
                      {exercise.body_part && (
                        <p className="text-sm text-muted-foreground">
                          {exercise.body_part}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(exercise.id, exercise.is_favorite);
                      }}
                    >
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nonFavorites.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Alle Oefeningen</h3>
              <div className="space-y-2">
                {nonFavorites.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => addExerciseToWorkout(exercise.id)}
                  >
                    <div>
                      <p className="font-medium">{exercise.name}</p>
                      {exercise.body_part && (
                        <p className="text-sm text-muted-foreground">
                          {exercise.body_part}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(exercise.id, exercise.is_favorite);
                      }}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {exercises.length === 0 && !searchQuery && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nog geen oefeningen.</p>
              <p className="text-sm">Begin met typen om een oefening aan te maken.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
