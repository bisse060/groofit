import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Trash2, Star, Play } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Exercise {
  id: string;
  name: string;
  body_part: string | null;
  difficulty: string | null;
  equipment: string | null;
  instructions: string | null;
  image_url: string | null;
  video_url: string | null;
  is_favorite: boolean;
  primary_muscles: string[] | null;
  secondary_muscles: string[] | null;
}

const BODY_PARTS = [
  { value: 'chest', label: 'Borst' },
  { value: 'back', label: 'Rug' },
  { value: 'shoulders', label: 'Schouders' },
  { value: 'arms', label: 'Armen' },
  { value: 'legs', label: 'Benen' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
];

const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const MUSCLE_OPTIONS = [
  'Chest', 'Upper Chest', 'Lower Chest',
  'Back', 'Lats', 'Traps', 'Lower Back',
  'Shoulders', 'Front Delts', 'Side Delts', 'Rear Delts',
  'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Calves',
  'Abs', 'Obliques', 'Lower Abs',
];

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isNew = id === 'new';

  useEffect(() => {
    if (user) {
      if (isNew) {
        setExercise({
          id: '',
          name: '',
          body_part: null,
          difficulty: null,
          equipment: null,
          instructions: null,
          image_url: null,
          video_url: null,
          is_favorite: false,
          primary_muscles: [],
          secondary_muscles: [],
        });
        setLoading(false);
      } else {
        loadExercise();
      }
    }
  }, [user, id, isNew]);

  const loadExercise = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setExercise(data);
    } catch (error) {
      console.error('Error loading exercise:', error);
      toast.error('Fout bij het laden van oefening');
      navigate('/exercises');
    } finally {
      setLoading(false);
    }
  };

  const saveExercise = async () => {
    if (!exercise?.name.trim()) {
      toast.error('Naam is verplicht');
      return;
    }

    try {
      setSaving(true);
      
      if (isNew) {
        const { data, error } = await supabase
          .from('exercises')
          .insert({
            user_id: user?.id,
            name: exercise.name,
            body_part: exercise.body_part,
            difficulty: exercise.difficulty,
            equipment: exercise.equipment,
            instructions: exercise.instructions,
            image_url: exercise.image_url,
            video_url: exercise.video_url,
            is_favorite: exercise.is_favorite,
            primary_muscles: exercise.primary_muscles,
            secondary_muscles: exercise.secondary_muscles,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success('Oefening aangemaakt');
        navigate(`/exercises/${data.id}`);
      } else {
        const { error } = await supabase
          .from('exercises')
          .update({
            name: exercise.name,
            body_part: exercise.body_part,
            difficulty: exercise.difficulty,
            equipment: exercise.equipment,
            instructions: exercise.instructions,
            image_url: exercise.image_url,
            video_url: exercise.video_url,
            is_favorite: exercise.is_favorite,
            primary_muscles: exercise.primary_muscles,
            secondary_muscles: exercise.secondary_muscles,
          })
          .eq('id', id);

        if (error) throw error;
        toast.success('Oefening opgeslagen');
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
      toast.error('Fout bij het opslaan van oefening');
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = async () => {
    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Oefening verwijderd');
      navigate('/exercises');
    } catch (error) {
      console.error('Error deleting exercise:', error);
      toast.error('Fout bij het verwijderen van oefening');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-4">
          <p className="text-center py-12 text-muted-foreground">Oefening laden...</p>
        </div>
      </Layout>
    );
  }

  if (!exercise) {
    return (
      <Layout>
        <div className="container mx-auto p-4">
          <p className="text-center py-12 text-muted-foreground">Oefening niet gevonden</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/exercises')}>
            <ArrowLeft className="h-4 w-4" />
            Terug
          </Button>
          <div className="flex gap-2">
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4" />
                    Verwijder
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deze actie kan niet ongedaan gemaakt worden. De oefening wordt permanent verwijderd.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteExercise}>Verwijder</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={saveExercise} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isNew ? 'Nieuwe Oefening' : 'Oefening Bewerken'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Naam *</label>
              <Input
                value={exercise.name}
                onChange={(e) => setExercise({ ...exercise, name: e.target.value })}
                placeholder="Bijv. Bench Press"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Body Part</label>
                <Select
                  value={exercise.body_part || 'none'}
                  onValueChange={(value) => 
                    setExercise({ ...exercise, body_part: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer body part" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen</SelectItem>
                    {BODY_PARTS.map(bp => (
                      <SelectItem key={bp.value} value={bp.value}>
                        {bp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Moeilijkheid</label>
                <Select
                  value={exercise.difficulty || 'none'}
                  onValueChange={(value) => 
                    setExercise({ ...exercise, difficulty: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer moeilijkheid" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen</SelectItem>
                    {DIFFICULTIES.map(diff => (
                      <SelectItem key={diff.value} value={diff.value}>
                        {diff.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Equipment</label>
              <Input
                value={exercise.equipment || ''}
                onChange={(e) => setExercise({ ...exercise, equipment: e.target.value })}
                placeholder="Bijv. Barbell, Dumbbells, Bodyweight"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Afbeelding URL</label>
              <Input
                value={exercise.image_url || ''}
                onChange={(e) => setExercise({ ...exercise, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
              {exercise.image_url && (
                <div className="aspect-video w-full overflow-hidden rounded-lg border">
                  <img
                    src={exercise.image_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Video URL</label>
              <Input
                value={exercise.video_url || ''}
                onChange={(e) => setExercise({ ...exercise, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
              {exercise.video_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(exercise.video_url!, '_blank')}
                  className="w-full"
                >
                  <Play className="h-4 w-4" />
                  Bekijk Video
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instructies</label>
              <Textarea
                value={exercise.instructions || ''}
                onChange={(e) => setExercise({ ...exercise, instructions: e.target.value })}
                placeholder="Stap-voor-stap instructies..."
                rows={6}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={exercise.is_favorite ? 'default' : 'outline'}
                onClick={() => setExercise({ ...exercise, is_favorite: !exercise.is_favorite })}
              >
                <Star className={`h-4 w-4 ${exercise.is_favorite ? 'fill-current' : ''}`} />
                {exercise.is_favorite ? 'Favoriet' : 'Toevoegen aan favorieten'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
