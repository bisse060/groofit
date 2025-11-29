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
import { Plus, Camera, X } from 'lucide-react';
import { ImageCropper } from '@/components/ImageCropper';

interface Measurement {
  id: string;
  measurement_date: string;
  weight: number | null;
  shoulder_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  bicep_left_cm: number | null;
  bicep_right_cm: number | null;
  notes: string | null;
}

interface ProgressPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  description: string | null;
}

export default function Measurements() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measurementPhotos, setMeasurementPhotos] = useState<Record<string, ProgressPhoto[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    measurement_date: format(new Date(), 'yyyy-MM-dd'),
    weight: '',
    shoulder_cm: '',
    chest_cm: '',
    waist_cm: '',
    hips_cm: '',
    bicep_left_cm: '',
    bicep_right_cm: '',
    notes: '',
  });
  const [photos, setPhotos] = useState<{
    front: File | null;
    side: File | null;
    back: File | null;
  }>({
    front: null,
    side: null,
    back: null,
  });
  const [cropImage, setCropImage] = useState<{
    type: 'front' | 'side' | 'back' | null;
    url: string | null;
  }>({ type: null, url: null });

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
      
      // Load photos for each measurement
      if (data && data.length > 0) {
        const photoPromises = data.map(async (measurement) => {
          const { data: photos } = await supabase
            .from('progress_photos')
            .select('id, photo_url, photo_type, description')
            .eq('measurement_id', measurement.id);
          return { measurementId: measurement.id, photos: photos || [] };
        });
        
        const photoResults = await Promise.all(photoPromises);
        const photoMap: Record<string, ProgressPhoto[]> = {};
        photoResults.forEach(({ measurementId, photos }) => {
          photoMap[measurementId] = photos;
        });
        setMeasurementPhotos(photoMap);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that all required photos are provided
    if (!photos.front || !photos.side || !photos.back) {
      toast.error('Please upload all three photos (front, side, back)');
      return;
    }
    
    setSaving(true);

    try {
      // First, create the measurement
      const { data: measurement, error: measurementError } = await supabase
        .from('measurements')
        .insert({
          user_id: user?.id,
          measurement_date: formData.measurement_date,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          shoulder_cm: formData.shoulder_cm ? parseFloat(formData.shoulder_cm) : null,
          chest_cm: formData.chest_cm ? parseFloat(formData.chest_cm) : null,
          waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : null,
          hips_cm: formData.hips_cm ? parseFloat(formData.hips_cm) : null,
          bicep_left_cm: formData.bicep_left_cm ? parseFloat(formData.bicep_left_cm) : null,
          bicep_right_cm: formData.bicep_right_cm ? parseFloat(formData.bicep_right_cm) : null,
          notes: formData.notes,
        })
        .select()
        .single();

      if (measurementError) throw measurementError;

      // Upload photos
      const photoTypes: Array<'front' | 'side' | 'back'> = ['front', 'side', 'back'];
      const uploadPromises = photoTypes.map(async (type) => {
        const file = photos[type];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${measurement.id}/${type}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('progress-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('progress-photos')
          .getPublicUrl(fileName);

        // Create progress_photos record
        const { error: photoError } = await supabase.from('progress_photos').insert({
          user_id: user?.id,
          measurement_id: measurement.id,
          photo_date: formData.measurement_date,
          photo_type: type,
          photo_url: publicUrl,
        });

        if (photoError) throw photoError;
      });

      await Promise.all(uploadPromises);

      toast.success('Measurement and photos saved successfully!');
      setShowForm(false);
      setFormData({
        measurement_date: format(new Date(), 'yyyy-MM-dd'),
        weight: '',
        shoulder_cm: '',
        chest_cm: '',
        waist_cm: '',
        hips_cm: '',
        bicep_left_cm: '',
        bicep_right_cm: '',
        notes: '',
      });
      setPhotos({ front: null, side: null, back: null });
      loadMeasurements();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = (type: 'front' | 'side' | 'back', file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCropImage({ type, url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (type: 'front' | 'side' | 'back', croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], `${type}.jpg`, { type: 'image/jpeg' });
    setPhotos((prev) => ({ ...prev, [type]: croppedFile }));
    setCropImage({ type: null, url: null });
  };

  const handlePhotoRemove = (type: 'front' | 'side' | 'back') => {
    setPhotos((prev) => ({ ...prev, [type]: null }));
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
      {cropImage.url && cropImage.type && (
        <ImageCropper
          image={cropImage.url}
          onCropComplete={(croppedBlob) => handleCropComplete(cropImage.type!, croppedBlob)}
          onCancel={() => setCropImage({ type: null, url: null })}
        />
      )}
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
                    <Label htmlFor="shoulder">Schouders (cm)</Label>
                    <Input
                      id="shoulder"
                      type="number"
                      step="0.1"
                      value={formData.shoulder_cm}
                      onChange={(e) => setFormData({ ...formData, shoulder_cm: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
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

                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Progress Photos (Required)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Upload photos from front, side, and back views
                  </p>

                  <div className="grid gap-4 md:grid-cols-3">
                    {(['front', 'side', 'back'] as const).map((type) => (
                      <div key={type} className="space-y-2">
                        <Label htmlFor={`photo-${type}`} className="capitalize">
                          {type} View *
                        </Label>
                        <div className="relative">
                          {!photos[type] ? (
                            <Input
                              id={`photo-${type}`}
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                handlePhotoSelect(type, file);
                              }}
                              className="cursor-pointer"
                              required
                            />
                          ) : (
                            <div className="relative">
                              <img
                                src={URL.createObjectURL(photos[type]!)}
                                alt={`${type} preview`}
                                className="w-full aspect-[9/16] object-cover rounded-lg"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={() => handlePhotoRemove(type)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? t('common.loading') : t('common.save')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setPhotos({ front: null, side: null, back: null });
                    }}
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
          {measurements.map((measurement) => {
            const photos = measurementPhotos[measurement.id] || [];
            return (
              <Card key={measurement.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {format(new Date(measurement.measurement_date), 'MMMM dd, yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    {measurement.weight && (
                      <div>
                        <p className="text-sm text-muted-foreground">Weight</p>
                        <p className="font-semibold">{measurement.weight} kg</p>
                      </div>
                    )}
                    {measurement.shoulder_cm && (
                      <div>
                        <p className="text-sm text-muted-foreground">Schouders</p>
                        <p className="font-semibold">{measurement.shoulder_cm} cm</p>
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
                  
                  {photos.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        Progress Photos
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {['front', 'side', 'back'].map((type) => {
                          const photo = photos.find((p) => p.photo_type === type);
                          return photo ? (
                            <div key={type} className="space-y-1">
                              <img
                                src={photo.photo_url}
                                alt={`${type} view`}
                                className="w-full aspect-[9/16] object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(photo.photo_url, '_blank')}
                              />
                              <p className="text-xs text-center text-muted-foreground capitalize">
                                {type}
                              </p>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  
                  {measurement.notes && (
                    <p className="text-sm text-muted-foreground border-t pt-4">{measurement.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
