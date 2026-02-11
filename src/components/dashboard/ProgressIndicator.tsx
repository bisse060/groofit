import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus, Scale, Ruler } from 'lucide-react';

interface MeasurementChange {
  label: string;
  change: number | null;
  unit: string;
  invertColor?: boolean; // true = decrease is good (weight, waist)
}

export default function ProgressIndicator() {
  const { user } = useAuth();
  const [changes, setChanges] = useState<MeasurementChange[]>([]);
  const [daysSpan, setDaysSpan] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadProgress();
  }, [user]);

  const loadProgress = async () => {
    try {
      const { data: measurements } = await supabase
        .from('measurements')
        .select('measurement_date, weight, waist_cm, shoulder_cm, chest_cm, hips_cm, bicep_left_cm, bicep_right_cm')
        .eq('user_id', user?.id)
        .order('measurement_date', { ascending: false })
        .limit(4);

      if (measurements && measurements.length >= 2) {
        const latest = measurements[0];
        const oldest = measurements[measurements.length - 1];

        const daysDiff = Math.round(
          (new Date(latest.measurement_date).getTime() - new Date(oldest.measurement_date).getTime())
          / (1000 * 60 * 60 * 24)
        );
        setDaysSpan(daysDiff);

        const calc = (a: number | null, b: number | null) =>
          a != null && b != null ? Number(a) - Number(b) : null;

        const result: MeasurementChange[] = [
          { label: 'Gewicht', change: calc(latest.weight, oldest.weight), unit: 'kg', invertColor: true },
          { label: 'Schouders', change: calc(latest.shoulder_cm, oldest.shoulder_cm), unit: 'cm' },
          { label: 'Borst', change: calc(latest.chest_cm, oldest.chest_cm), unit: 'cm' },
          { label: 'Taille', change: calc(latest.waist_cm, oldest.waist_cm), unit: 'cm', invertColor: true },
          { label: 'Heupen', change: calc(latest.hips_cm, oldest.hips_cm), unit: 'cm' },
          { label: 'Bicep L', change: calc(latest.bicep_left_cm, oldest.bicep_left_cm), unit: 'cm' },
          { label: 'Bicep R', change: calc(latest.bicep_right_cm, oldest.bicep_right_cm), unit: 'cm' },
        ].filter(c => c.change !== null);

        setChanges(result);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeColor = (change: number | null, invert?: boolean) => {
    if (change === null || change === 0) return 'text-muted-foreground';
    const isPositiveGood = invert ? change < 0 : change > 0;
    return isPositiveGood ? 'text-success' : 'text-secondary';
  };

  const getIcon = (change: number | null) => {
    if (change === null || change === 0) return Minus;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const formatChange = (change: number | null) => {
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

  if (changes.length === 0) {
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
              <p className="text-xs text-muted-foreground">{daysSpan} dagen</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {changes.map((item) => {
            const Icon = getIcon(item.change);
            return (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <div className={`flex items-center gap-1 ${getChangeColor(item.change, item.invertColor)}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="font-semibold tabular-nums text-sm">
                    {formatChange(item.change)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
