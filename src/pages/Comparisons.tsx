import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import TimelineView from '@/components/comparisons/TimelineView';
import { useNavigate } from 'react-router-dom';
import WatermarkedImage from '@/components/WatermarkedImage';
import { signPhotoUrls } from '@/lib/storage-utils';

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
}

interface ProgressPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  photo_date: string;
}

export default function Comparisons() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [firstMeasurement, setFirstMeasurement] = useState<string>('');
  const [secondMeasurement, setSecondMeasurement] = useState<string>('');
  const [firstPhotos, setFirstPhotos] = useState<ProgressPhoto[]>([]);
  const [secondPhotos, setSecondPhotos] = useState<ProgressPhoto[]>([]);
  const [timelinePhotos, setTimelinePhotos] = useState<Record<string, ProgressPhoto[]>>({});
  const [currentPhotoType, setCurrentPhotoType] = useState<'front' | 'side' | 'back'>('front');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      loadMeasurements();
    }
  }, [user, authLoading, navigate]);

  const loadMeasurements = async () => {
    try {
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', user?.id)
        .order('measurement_date', { ascending: false });

      if (error) throw error;
      setMeasurements(data || []);
      
      // Automatically select the two most recent measurements
      if (data && data.length >= 2) {
        setSecondMeasurement(data[0].id); // Most recent
        setFirstMeasurement(data[1].id);  // Second most recent
      } else if (data && data.length === 1) {
        setFirstMeasurement(data[0].id);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firstMeasurement) {
      loadPhotos(firstMeasurement, setFirstPhotos);
    }
  }, [firstMeasurement]);

  useEffect(() => {
    if (secondMeasurement) {
      loadPhotos(secondMeasurement, setSecondPhotos);
    }
  }, [secondMeasurement]);

  useEffect(() => {
    if (measurements.length > 0) {
      loadTimelinePhotos();
    }
  }, [measurements]);

  const loadTimelinePhotos = async () => {
    try {
      const measurementIds = measurements.slice(0, 8).map(m => m.id);
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .in('measurement_id', measurementIds);

      if (error) throw error;

      const signedData = data ? await signPhotoUrls(data) : [];
      const photosMap: Record<string, ProgressPhoto[]> = {};
      signedData.forEach(photo => {
        if (!photosMap[photo.measurement_id]) {
          photosMap[photo.measurement_id] = [];
        }
        photosMap[photo.measurement_id].push(photo);
      });

      setTimelinePhotos(photosMap);
    } catch (error: any) {
      console.error('Error loading timeline photos:', error);
    }
  };

  const loadPhotos = async (measurementId: string, setPhotos: (photos: ProgressPhoto[]) => void) => {
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('measurement_id', measurementId)
        .order('photo_type');

      if (error) throw error;
      const signedPhotos = data ? await signPhotoUrls(data) : [];
      setPhotos(signedPhotos);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const first = measurements.find((m) => m.id === firstMeasurement);
  const second = measurements.find((m) => m.id === secondMeasurement);

  const getPhotoByType = (photos: ProgressPhoto[], type: string) => {
    return photos.find(p => p.photo_type === type)?.photo_url;
  };

  const calculateDifference = (firstValue: number | null, secondValue: number | null) => {
    if (firstValue === null || secondValue === null) return null;
    return secondValue - firstValue;
  };

  const calculatePercentage = (firstValue: number | null, secondValue: number | null) => {
    if (firstValue === null || secondValue === null || firstValue === 0) return null;
    const diff = secondValue - firstValue;
    return (diff / firstValue) * 100;
  };

  const formatDifference = (diff: number | null, percentage: number | null) => {
    if (diff === null) return '-';
    const sign = diff > 0 ? '+' : '';
    const percentSign = percentage && percentage > 0 ? '+' : '';
    const percentText = percentage !== null ? ` (${percentSign}${percentage.toFixed(1)}%)` : '';
    return `${sign}${diff.toFixed(1)}${percentText}`;
  };

  const photoTypes: Array<'front' | 'side' | 'back'> = ['front', 'side', 'back'];
  const photoTypeLabels = {
    front: 'Voorkant',
    side: 'Zijkant',
    back: 'Achterkant'
  };

  const handlePreviousPhoto = () => {
    const currentIndex = photoTypes.indexOf(currentPhotoType);
    const newIndex = currentIndex === 0 ? photoTypes.length - 1 : currentIndex - 1;
    setCurrentPhotoType(photoTypes[newIndex]);
  };

  const handleNextPhoto = () => {
    const currentIndex = photoTypes.indexOf(currentPhotoType);
    const newIndex = currentIndex === photoTypes.length - 1 ? 0 : currentIndex + 1;
    setCurrentPhotoType(photoTypes[newIndex]);
  };

  const getDifferenceColor = (diff: number | null, fieldKey: string) => {
    if (diff === null || diff === 0) return 'text-muted-foreground';
    // Voor gewicht en taille: afname = groen (goed)
    // Voor andere metingen: toename = groen (goed, spiergroei)
    const isWeightOrWaist = fieldKey === 'weight' || fieldKey === 'waist_cm';
    if (isWeightOrWaist) {
      return diff < 0 ? 'text-success' : 'text-destructive';
    } else {
      return diff > 0 ? 'text-success' : 'text-destructive';
    }
  };

  const DifferenceIcon = ({ diff, fieldKey }: { diff: number | null; fieldKey: string }) => {
    if (diff === null || diff === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const isWeightOrWaist = fieldKey === 'weight' || fieldKey === 'waist_cm';
    if (isWeightOrWaist) {
      // Voor gewicht en taille: afname = groen (goed)
      if (diff < 0) return <ArrowDown className="h-4 w-4 text-success" />;
      return <ArrowUp className="h-4 w-4 text-destructive" />;
    } else {
      // Voor andere metingen: toename = groen (goed, spiergroei)
      if (diff > 0) return <ArrowUp className="h-4 w-4 text-success" />;
      return <ArrowDown className="h-4 w-4 text-destructive" />;
    }
  };

  const comparisonFields = [
    { key: 'weight', label: t('logs.weight'), unit: 'kg' },
    { key: 'shoulder_cm', label: 'Schouders', unit: 'cm' },
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
          <h1 className="text-2xl font-semibold">{t('comparisons.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">Vergelijk metingen om je voortgang te zien</p>
        </div>

        <Tabs defaultValue="comparison" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="comparison">Laatste 2 Metingen</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="space-y-6">
            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Eerste meting (eerder)</label>
                <Select value={firstMeasurement} onValueChange={setFirstMeasurement}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecteer datum" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {measurements.map((m) => (
                      <SelectItem key={m.id} value={m.id} disabled={m.id === secondMeasurement}>
                        {format(new Date(m.measurement_date), 'dd MMM yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tweede meting (later)</label>
                <Select value={secondMeasurement} onValueChange={setSecondMeasurement}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecteer datum" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {measurements.map((m) => (
                      <SelectItem key={m.id} value={m.id} disabled={m.id === firstMeasurement}>
                        {format(new Date(m.measurement_date), 'dd MMM yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-4 md:p-6">
                {first && second ? (
                  <div className="space-y-4">
                    {/* Photo Type Navigation */}
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePreviousPhoto}
                        className="h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-semibold min-w-[100px] text-center">
                        {photoTypeLabels[currentPhotoType]}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleNextPhoto}
                        className="h-8 w-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Photos side by side */}
                    <div className="grid grid-cols-2 gap-2 md:gap-6 max-w-2xl mx-auto">
                      {/* First Measurement */}
                      <div className="space-y-2">
                        <div className="text-center">
                          <h3 className="font-semibold text-xs md:text-sm">
                            {format(new Date(first.measurement_date), 'dd MMM yyyy')}
                          </h3>
                        </div>
                        <div className="flex justify-center">
                          {(() => {
                            const photo = getPhotoByType(firstPhotos, currentPhotoType);
                            return photo ? (
                              <WatermarkedImage 
                                src={photo} 
                                alt={currentPhotoType}
                                className="w-full aspect-[3/5] object-contain rounded bg-muted md:max-h-[500px]"
                              />
                            ) : (
                              <div className="w-full aspect-[3/5] bg-muted rounded flex items-center justify-center">
                                <p className="text-xs text-muted-foreground text-center px-2">Geen foto</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Second Measurement */}
                      <div className="space-y-2">
                        <div className="text-center">
                          <h3 className="font-semibold text-xs md:text-sm">
                            {format(new Date(second.measurement_date), 'dd MMM yyyy')}
                          </h3>
                        </div>
                        <div className="flex justify-center">
                          {(() => {
                            const photo = getPhotoByType(secondPhotos, currentPhotoType);
                            return photo ? (
                              <WatermarkedImage 
                                src={photo} 
                                alt={currentPhotoType}
                                className="w-full aspect-[3/5] object-contain rounded bg-muted md:max-h-[500px]"
                              />
                            ) : (
                              <div className="w-full aspect-[3/5] bg-muted rounded flex items-center justify-center">
                                <p className="text-xs text-muted-foreground text-center px-2">Geen foto</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Measurements comparison table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs md:text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 font-medium">Meting</th>
                            <th className="text-right p-2 font-medium">Eerste</th>
                            <th className="text-right p-2 font-medium">Tweede</th>
                            <th className="text-right p-2 font-medium">Verschil</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonFields.map((field) => {
                            const firstValue = first[field.key as keyof Measurement] as number | null;
                            const secondValue = second[field.key as keyof Measurement] as number | null;
                            const diff = calculateDifference(firstValue, secondValue);
                            if (firstValue === null && secondValue === null) return null;
                            return (
                              <tr key={field.key} className="border-t">
                                <td className="p-2 text-muted-foreground">{field.label}</td>
                                <td className="p-2 text-right">
                                  {firstValue !== null ? `${firstValue}` : '-'}
                                </td>
                                <td className="p-2 text-right">
                                  {secondValue !== null ? `${secondValue}` : '-'}
                                </td>
                                <td className={`p-2 text-right font-medium ${getDifferenceColor(diff, field.key)}`}>
                                  <div className="flex items-center justify-end gap-1">
                                    <DifferenceIcon diff={diff} fieldKey={field.key} />
                                    <span>{diff !== null ? (diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)) : '-'}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">{t('comparisons.noData')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Metingen Timeline</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Overzicht van je laatste {Math.min(8, measurements.length)} metingen
                </p>
              </CardHeader>
              <CardContent>
                <TimelineView 
                  measurements={measurements.slice(0, 8)} 
                  photosMap={timelinePhotos}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
