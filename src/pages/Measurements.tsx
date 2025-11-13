import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

interface Measurement {
  id: string;
  measurement_date: string;
  weight: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  bicep_left_cm: number | null;
  bicep_right_cm: number | null;
  notes: string | null;
}

export default function Measurements() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    measurement_date: format(new Date(), 'yyyy-MM-dd'),
    weight: '',
    chest_cm: '',
    waist_cm: '',
    hips_cm: '',
    bicep_left_cm: '',
    bicep_right_cm: '',
    notes: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from('measurements').insert({
        user_id: user?.id,
        measurement_date: formData.measurement_date,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        chest_cm: formData.chest_cm ? parseFloat(formData.chest_cm) : null,
        waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : null,
        hips_cm: formData.hips_cm ? parseFloat(formData.hips_cm) : null,
        bicep_left_cm: formData.bicep_left_cm ? parseFloat(formData.bicep_left_cm) : null,
        bicep_right_cm: formData.bicep_right_cm ? parseFloat(formData.bicep_right_cm) : null,
        notes: formData.notes,
      });

      if (error) throw error;

      toast.success('Measurement saved successfully!');
      setShowForm(false);
      setFormData({
        measurement_date: format(new Date(), 'yyyy-MM-dd'),
        weight: '',
        chest_cm: '',
        waist_cm: '',
        hips_cm: '',
        bicep_left_cm: '',
        bicep_right_cm: '',
        notes: '',
      });
      loadMeasurements();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('measurements.title')}</h1>
            <p className="text-muted-foreground">Track your body measurements over time</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Measurement
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Measurement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">{t('logs.date')}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.measurement_date}
                    onChange={(e) =>
                      setFormData({ ...formData, measurement_date: e.target.value })
                    }
                    max={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="weight">{t('logs.weight')}</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chest">{t('measurements.chest')}</Label>
                    <Input
                      id="chest"
                      type="number"
                      step="0.1"
                      value={formData.chest_cm}
                      onChange={(e) => setFormData({ ...formData, chest_cm: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="waist">{t('measurements.waist')}</Label>
                    <Input
                      id="waist"
                      type="number"
                      step="0.1"
                      value={formData.waist_cm}
                      onChange={(e) => setFormData({ ...formData, waist_cm: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hips">{t('measurements.hips')}</Label>
                    <Input
                      id="hips"
                      type="number"
                      step="0.1"
                      value={formData.hips_cm}
                      onChange={(e) => setFormData({ ...formData, hips_cm: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bicep_left">{t('measurements.bicepLeft')}</Label>
                    <Input
                      id="bicep_left"
                      type="number"
                      step="0.1"
                      value={formData.bicep_left_cm}
                      onChange={(e) =>
                        setFormData({ ...formData, bicep_left_cm: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bicep_right">{t('measurements.bicepRight')}</Label>
                    <Input
                      id="bicep_right"
                      type="number"
                      step="0.1"
                      value={formData.bicep_right_cm}
                      onChange={(e) =>
                        setFormData({ ...formData, bicep_right_cm: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t('logs.notes')}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? t('common.loading') : t('common.save')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1"
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {measurements.map((measurement) => (
            <Card key={measurement.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(new Date(measurement.measurement_date), 'MMMM dd, yyyy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-3">
                  {measurement.weight && (
                    <div>
                      <p className="text-sm text-muted-foreground">Weight</p>
                      <p className="font-semibold">{measurement.weight} kg</p>
                    </div>
                  )}
                  {measurement.chest_cm && (
                    <div>
                      <p className="text-sm text-muted-foreground">Chest</p>
                      <p className="font-semibold">{measurement.chest_cm} cm</p>
                    </div>
                  )}
                  {measurement.waist_cm && (
                    <div>
                      <p className="text-sm text-muted-foreground">Waist</p>
                      <p className="font-semibold">{measurement.waist_cm} cm</p>
                    </div>
                  )}
                  {measurement.hips_cm && (
                    <div>
                      <p className="text-sm text-muted-foreground">Hips</p>
                      <p className="font-semibold">{measurement.hips_cm} cm</p>
                    </div>
                  )}
                  {measurement.bicep_left_cm && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bicep Left</p>
                      <p className="font-semibold">{measurement.bicep_left_cm} cm</p>
                    </div>
                  )}
                  {measurement.bicep_right_cm && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bicep Right</p>
                      <p className="font-semibold">{measurement.bicep_right_cm} cm</p>
                    </div>
                  )}
                </div>
                {measurement.notes && (
                  <p className="mt-4 text-sm text-muted-foreground">{measurement.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
