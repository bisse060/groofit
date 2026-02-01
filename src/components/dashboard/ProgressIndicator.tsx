import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus, Scale, Ruler } from 'lucide-react';

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

  const getChangeColor = (change: number | null) => {
    if (change === null) return 'text-muted-foreground';
    if (change < 0) return 'text-success';
    if (change > 0) return 'text-secondary';
    return 'text-muted-foreground';
  };

  const formatChange = (change: number | null, unit: string) => {
    if (change === null) return '-';
    const prefix = change > 0 ? '+' : '';
    return `${prefix}${change.toFixed(1)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (progress.weightChange === null && progress.waistChange === null) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <p className="text-sm font-medium">Voortgang</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Voeg 2+ metingen toe om voortgang te zien
          </p>
        </CardContent>
      </Card>
    );
  }

  const WeightIcon = getChangeIcon(progress.weightChange);
  const WaistIcon = getChangeIcon(progress.waistChange);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-sm font-medium">Voortgang</p>
              <p className="text-xs text-muted-foreground">{progress.daysSpan} dagen</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {progress.weightChange !== null && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Gewicht</span>
              </div>
              <div className={`flex items-center gap-1 ${getChangeColor(progress.weightChange)}`}>
                <WeightIcon className="h-4 w-4" />
                <span className="font-semibold tabular-nums">
                  {formatChange(progress.weightChange, 'kg')}
                </span>
                <span className="text-xs text-muted-foreground">kg</span>
              </div>
            </div>
          )}
          
          {progress.waistChange !== null && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Taille</span>
              </div>
              <div className={`flex items-center gap-1 ${getChangeColor(progress.waistChange)}`}>
                <WaistIcon className="h-4 w-4" />
                <span className="font-semibold tabular-nums">
                  {formatChange(progress.waistChange, 'cm')}
                </span>
                <span className="text-xs text-muted-foreground">cm</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
