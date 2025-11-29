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
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import TimelineView from '@/components/comparisons/TimelineView';
import { useNavigate } from 'react-router-dom';

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

      const photosMap: Record<string, ProgressPhoto[]> = {};
      data?.forEach(photo => {
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
      setPhotos(data || []);
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('comparisons.title')}</h1>
          <p className="text-muted-foreground">Compare two measurements to track your progress</p>
        </div>

        <Tabs defaultValue="comparison" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="comparison">Laatste 2 Metingen</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                {first && second ? (
                  <div className="overflow-x-auto">
                    <div className="flex gap-4 pb-4">
                      {/* First Measurement Card */}
                      <Card className="flex-shrink-0 w-80">
                        <CardContent className="p-4 space-y-3">
                          <div className="text-center">
                            <h3 className="font-semibold text-lg">
                              {format(new Date(first.measurement_date), 'dd MMM yyyy')}
                            </h3>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {(['front', 'side', 'back'] as const).map((type) => {
                              const photo = getPhotoByType(firstPhotos, type);
                              return photo ? (
                                <div key={type} className="space-y-1">
                                  <img 
                                    src={photo} 
                                    alt={type}
                                    className="w-full aspect-[5/16] object-contain rounded bg-muted"
                                  />
                                  <p className="text-xs text-center text-muted-foreground capitalize">{type}</p>
                                </div>
                              ) : (
                                <div key={type} className="aspect-[5/16] bg-muted rounded flex items-center justify-center">
                                  <p className="text-xs text-muted-foreground">-</p>
                                </div>
                              );
                            })}
                          </div>

                          <div className="space-y-2 text-sm">
                            {comparisonFields.map((field) => {
                              const value = first[field.key as keyof Measurement] as number | null;
                              if (value === null) return null;
                              return (
                                <div key={field.key} className="flex justify-between">
                                  <span className="text-muted-foreground">{field.label}:</span>
                                  <span className="font-medium">{value} {field.unit}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Difference Arrow */}
                      <div className="flex items-center justify-center px-4">
                        <div className="text-3xl text-muted-foreground">→</div>
                      </div>

                      {/* Second Measurement Card */}
                      <Card className="flex-shrink-0 w-80">
                        <CardContent className="p-4 space-y-3">
                          <div className="text-center">
                            <h3 className="font-semibold text-lg">
                              {format(new Date(second.measurement_date), 'dd MMM yyyy')}
                            </h3>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {(['front', 'side', 'back'] as const).map((type) => {
                              const photo = getPhotoByType(secondPhotos, type);
                              return photo ? (
                                <div key={type} className="space-y-1">
                                  <img 
                                    src={photo} 
                                    alt={type}
                                    className="w-full aspect-[5/16] object-contain rounded bg-muted"
                                  />
                                  <p className="text-xs text-center text-muted-foreground capitalize">{type}</p>
                                </div>
                              ) : (
                                <div key={type} className="aspect-[5/16] bg-muted rounded flex items-center justify-center">
                                  <p className="text-xs text-muted-foreground">-</p>
                                </div>
                              );
                            })}
                          </div>

                          <div className="space-y-2 text-sm">
                            {comparisonFields.map((field) => {
                              const value = second[field.key as keyof Measurement] as number | null;
                              const firstValue = first[field.key as keyof Measurement] as number | null;
                              const diff = calculateDifference(firstValue, value);
                              const percentage = calculatePercentage(firstValue, value);
                              if (value === null) return null;
                              return (
                                <div key={field.key} className="flex justify-between items-center">
                                  <span className="text-muted-foreground">{field.label}:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{value} {field.unit}</span>
                                    {diff !== null && diff !== 0 && (
                                      <span className={`text-xs ${getDifferenceColor(diff, field.key)}`}>
                                        ({formatDifference(diff, percentage)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
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
