import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface Measurement {
  id: string;
  measurement_date: string;
  weight: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  bicep_left_cm: number | null;
  bicep_right_cm: number | null;
}

export default function Comparisons() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [firstMeasurement, setFirstMeasurement] = useState<string>('');
  const [secondMeasurement, setSecondMeasurement] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadMeasurements();
    }
  }, [user]);

  const loadMeasurements = async () => {
    try {
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', user?.id)
        .order('measurement_date', { ascending: false });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const first = measurements.find((m) => m.id === firstMeasurement);
  const second = measurements.find((m) => m.id === secondMeasurement);

  const calculateDifference = (firstValue: number | null, secondValue: number | null) => {
    if (firstValue === null || secondValue === null) return null;
    return secondValue - firstValue;
  };

  const formatDifference = (diff: number | null) => {
    if (diff === null) return '-';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}`;
  };

  const DifferenceIcon = ({ diff }: { diff: number | null }) => {
    if (diff === null || diff === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (diff > 0) return <ArrowUp className="h-4 w-4 text-destructive" />;
    return <ArrowDown className="h-4 w-4 text-success" />;
  };

  const comparisonFields = [
    { key: 'weight', label: t('logs.weight'), unit: 'kg' },
    { key: 'chest_cm', label: t('measurements.chest'), unit: 'cm' },
    { key: 'waist_cm', label: t('measurements.waist'), unit: 'cm' },
    { key: 'hips_cm', label: t('measurements.hips'), unit: 'cm' },
    { key: 'bicep_left_cm', label: t('measurements.bicepLeft'), unit: 'cm' },
    { key: 'bicep_right_cm', label: t('measurements.bicepRight'), unit: 'cm' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p>{t('common.loading')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('comparisons.title')}</h1>
          <p className="text-muted-foreground">Compare two measurements to track your progress</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Measurements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('comparisons.selectFirst')}</label>
                <Select value={firstMeasurement} onValueChange={setFirstMeasurement}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select measurement..." />
                  </SelectTrigger>
                  <SelectContent>
                    {measurements.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {format(new Date(m.measurement_date), 'MMM dd, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('comparisons.selectSecond')}</label>
                <Select value={secondMeasurement} onValueChange={setSecondMeasurement}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select measurement..." />
                  </SelectTrigger>
                  <SelectContent>
                    {measurements.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {format(new Date(m.measurement_date), 'MMM dd, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {first && second ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('comparisons.compare')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comparisonFields.map((field) => {
                  const firstVal = first[field.key as keyof Measurement] as number | null;
                  const secondVal = second[field.key as keyof Measurement] as number | null;
                  const diff = calculateDifference(firstVal, secondVal);

                  return (
                    <div
                      key={field.key}
                      className="grid grid-cols-4 gap-4 items-center p-4 rounded-lg bg-muted/50"
                    >
                      <div className="font-medium">{field.label}</div>
                      <div className="text-center">
                        {firstVal !== null ? `${firstVal} ${field.unit}` : '-'}
                      </div>
                      <div className="text-center">
                        {secondVal !== null ? `${secondVal} ${field.unit}` : '-'}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <DifferenceIcon diff={diff} />
                        <span className="font-semibold">
                          {formatDifference(diff)} {diff !== null && field.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Legend:</div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4 text-success" />
                    <span>Decrease</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-destructive" />
                    <span>Increase</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span>No change</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t('comparisons.noData')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
