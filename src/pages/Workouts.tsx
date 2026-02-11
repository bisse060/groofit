import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale/nl';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

interface Workout {
  id: string;
  date: string;
  title: string | null;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
}

export default function Workouts() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      loadWorkouts();
    }
  }, [user, authLoading, navigate]);

  const loadWorkouts = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, date, title, created_at, start_time, end_time')
        .eq('user_id', user?.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkouts(data || []);
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
          title: 'Workout'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Nieuwe workout aangemaakt');
      navigate(`/workouts/${data.id}`);
    } catch (error) {
      console.error('Error creating workout:', error);
      toast.error('Fout bij het aanmaken van workout');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Workouts</h1>
          </div>
          <Button onClick={createNewWorkout} className="self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe Workout
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Workouts laden...</p>
          </div>
        ) : workouts.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Dumbbell className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Nog geen workouts</h3>
                  <p className="text-muted-foreground mb-4">
                    Start je eerste workout om je krachttraining te loggen
                  </p>
                  <Button onClick={createNewWorkout}>
                    <Plus className="h-4 w-4" />
                    Start Workout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {workouts.map((workout) => (
              <Card
                key={workout.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/workouts/${workout.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{workout.title || 'Workout'}</span>
                    {workout.end_time && (
                      <span className="text-sm font-normal text-muted-foreground">
                        Afgerond
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(workout.date), 'EEEE d MMMM yyyy', { locale: nl })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
