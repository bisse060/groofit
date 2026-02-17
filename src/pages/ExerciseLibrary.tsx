import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Plus, Search, Star, Filter, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CsvUploadDialog } from '@/components/exercises/CsvUploadDialog';

interface Exercise {
  id: string;
  name: string;
  body_part: string | null;
  difficulty: string | null;
  equipment: string | null;
  is_favorite: boolean;
  primary_muscles: string[] | null;
  image_url: string | null;
}

const BODY_PARTS = [
  { value: 'all', label: 'Alle' },
  { value: 'chest', label: 'Borst' },
  { value: 'back', label: 'Rug' },
  { value: 'shoulders', label: 'Schouders' },
  { value: 'arms', label: 'Armen' },
  { value: 'legs', label: 'Benen' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500',
  intermediate: 'bg-yellow-500/10 text-yellow-500',
  advanced: 'bg-red-500/10 text-red-500',
};

export default function ExerciseLibrary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);

  useEffect(() => {
    if (user) {
      loadExercises();
    }
  }, [user]);

  useEffect(() => {
    filterExercises();
  }, [searchQuery, selectedBodyPart, showFavoritesOnly, exercises]);

  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Sign image URLs for private bucket
      const signed = await Promise.all((data || []).map(async (ex) => {
        if (ex.image_url && ex.image_url.includes('exercise-images')) {
          const marker = '/object/public/exercise-images/';
          const idx = ex.image_url.indexOf(marker);
          if (idx !== -1) {
            const filePath = ex.image_url.substring(idx + marker.length);
            const { data: signedData } = await supabase.storage
              .from('exercise-images')
              .createSignedUrl(filePath, 3600);
            return { ...ex, image_url: signedData?.signedUrl || ex.image_url };
          }
        }
        return ex;
      }));
      
      setExercises(signed);
    } catch (error) {
      console.error('Error loading exercises:', error);
      toast.error('Fout bij het laden van oefeningen');
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = () => {
    let filtered = exercises;

    if (searchQuery) {
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedBodyPart !== 'all') {
      filtered = filtered.filter(ex => ex.body_part === selectedBodyPart);
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter(ex => ex.is_favorite);
    }

    setFilteredExercises(filtered);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Oefeningen</h1>
              <p className="text-sm text-muted-foreground mt-1 hidden sm:block">Je oefeningen bibliotheek</p>
            </div>
          </div>
          <div className="flex gap-2 self-start">
            <Button variant="outline" size="sm" onClick={() => setShowCsvDialog(true)}>
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Importeer</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/exercises/new')}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nieuwe</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek oefeningen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedBodyPart} onValueChange={setSelectedBodyPart}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Body Part" />
                </SelectTrigger>
                <SelectContent>
                  {BODY_PARTS.map(bp => (
                    <SelectItem key={bp.value} value={bp.value}>
                      {bp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showFavoritesOnly ? 'default' : 'outline'}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                Favorieten
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Oefeningen laden...</p>
          </div>
        ) : filteredExercises.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Dumbbell className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Geen oefeningen gevonden</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || selectedBodyPart !== 'all' || showFavoritesOnly
                      ? 'Probeer andere filters'
                      : 'Voeg je eerste oefening toe'}
                  </p>
                  <Button onClick={() => navigate('/exercises/new')}>
                    <Plus className="h-4 w-4" />
                    Nieuwe Oefening
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredExercises.map((exercise) => (
              <Card
                key={exercise.id}
                className="cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => navigate(`/exercises/${exercise.id}`)}
              >
                {exercise.image_url ? (
                  <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                    <img
                      src={exercise.image_url}
                      alt={exercise.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-muted flex items-center justify-center rounded-t-lg">
                    <Dumbbell className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex-1">{exercise.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(exercise.id, exercise.is_favorite);
                      }}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          exercise.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''
                        }`}
                      />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {exercise.body_part && (
                      <Badge variant="secondary">
                        {BODY_PARTS.find(bp => bp.value === exercise.body_part)?.label || exercise.body_part}
                      </Badge>
                    )}
                    {exercise.difficulty && (
                      <Badge className={DIFFICULTY_COLORS[exercise.difficulty] || ''}>
                        {exercise.difficulty}
                      </Badge>
                    )}
                  </div>
                  {exercise.equipment && (
                    <p className="text-sm text-muted-foreground">{exercise.equipment}</p>
                  )}
                  {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {exercise.primary_muscles.join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <CsvUploadDialog
          open={showCsvDialog}
          onClose={() => setShowCsvDialog(false)}
          onImportComplete={loadExercises}
        />
      </div>
    </Layout>
  );
}
