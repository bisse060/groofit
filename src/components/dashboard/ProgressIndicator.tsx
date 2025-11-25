import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface ProgressData {
  weightChange: number | null;
  waistChange: number | null;
  daysSpan: number;
}

export default function ProgressIndicator() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressData>({
    weightChange: null,
    waistChange: null,
    daysSpan: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  const loadProgress = async () => {
    try {
      const date60d = new Date();
      date60d.setDate(date60d.getDate() - 60);

      const { data: measurements } = await supabase
        .from('measurements')
        .select('measurement_date, weight, waist_cm')
        .eq('user_id', user?.id)
        .gte('measurement_date', date60d.toISOString().split('T')[0])
        .order('measurement_date', { ascending: true });

      if (measurements && measurements.length >= 2) {
        const first = measurements[0];
        const last = measurements[measurements.length - 1];

        const weightChange = first.weight && last.weight 
          ? Number(last.weight) - Number(first.weight)
          : null;

        const waistChange = first.waist_cm && last.waist_cm
          ? Number(last.waist_cm) - Number(first.waist_cm)
          : null;

        const daysDiff = Math.round(
          (new Date(last.measurement_date).getTime() - new Date(first.measurement_date).getTime()) 
          / (1000 * 60 * 60 * 24)
        );

        setProgress({
          weightChange,
          waistChange,
          daysSpan: daysDiff,
        });
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (change: number | null) => {
    if (change === null) return Minus;
    if (change < 0) return TrendingDown;
    if (change > 0) return TrendingUp;
    return Minus;
  };

  const getChangeColor = (change: number | null, inverse: boolean = false) => {
    if (change === null) return 'text-muted-foreground';
    // For weight and waist, decrease is generally positive (hence inverse)
    if (inverse) {
      if (change < 0) return 'text-success';
      if (change > 0) return 'text-secondary';
    } else {
      if (change > 0) return 'text-success';
      if (change < 0) return 'text-secondary';
    }
    return 'text-muted-foreground';
  };

  const formatChange = (change: number | null, unit: string) => {
    if (change === null) return '-';
    const prefix = change > 0 ? '+' : '';
    return `${prefix}${change.toFixed(1)} ${unit}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voortgang</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  if (progress.weightChange === null && progress.waistChange === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voortgang</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Voeg minimaal 2 metingen toe in de laatste 60 dagen om je voortgang te zien.
          </p>
        </CardContent>
      </Card>
    );
  }

  const WeightIcon = getChangeIcon(progress.weightChange);
  const WaistIcon = getChangeIcon(progress.waistChange);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voortgang</CardTitle>
        <p className="text-sm text-muted-foreground">
          Laatste {progress.daysSpan} dagen
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {progress.weightChange !== null && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <WeightIcon className={`h-5 w-5 ${getChangeColor(progress.weightChange, true)}`} />
              <div>
                <p className="text-sm font-medium">Gewicht</p>
                <p className={`text-lg font-bold ${getChangeColor(progress.weightChange, true)}`}>
                  {formatChange(progress.weightChange, 'kg')}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {progress.waistChange !== null && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <WaistIcon className={`h-5 w-5 ${getChangeColor(progress.waistChange, true)}`} />
              <div>
                <p className="text-sm font-medium">Taille</p>
                <p className={`text-lg font-bold ${getChangeColor(progress.waistChange, true)}`}>
                  {formatChange(progress.waistChange, 'cm')}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}