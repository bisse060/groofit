import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface Measurement {
  id: string;
  measurement_date: string;
  weight: number | null;
  shoulder_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
}

interface ProgressPhoto {
  photo_url: string;
  photo_type: string;
}

interface TimelineItemProps {
  measurement: Measurement;
  photos: ProgressPhoto[];
}

export default function TimelineView({ 
  measurements, 
  photosMap 
}: { 
  measurements: Measurement[];
  photosMap: Record<string, ProgressPhoto[]>;
}) {
  const getPhotoByType = (photos: ProgressPhoto[], type: string) => {
    return photos.find(p => p.photo_type === type)?.photo_url;
  };

  if (measurements.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Geen metingen beschikbaar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="flex gap-4 pb-4 min-w-max">
          {measurements.map((measurement) => {
            const photos = photosMap[measurement.id] || [];
            const frontPhoto = getPhotoByType(photos, 'front');
            const sidePhoto = getPhotoByType(photos, 'side');
            const backPhoto = getPhotoByType(photos, 'back');

            return (
              <Card key={measurement.id} className="flex-shrink-0 w-80">
                <CardContent className="p-4 space-y-3">
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">
                      {format(new Date(measurement.measurement_date), 'dd MMM yyyy')}
                    </h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {frontPhoto ? (
                      <div className="space-y-1">
                        <img 
                          src={frontPhoto} 
                          alt="Front"
                          className="w-full aspect-[5/16] object-contain rounded bg-muted"
                        />
                        <p className="text-xs text-center text-muted-foreground">Front</p>
                      </div>
                    ) : (
                      <div className="aspect-[5/16] bg-muted rounded flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">-</p>
                      </div>
                    )}
                    
                    {sidePhoto ? (
                      <div className="space-y-1">
                        <img 
                          src={sidePhoto} 
                          alt="Side"
                          className="w-full aspect-[5/16] object-contain rounded bg-muted"
                        />
                        <p className="text-xs text-center text-muted-foreground">Side</p>
                      </div>
                    ) : (
                      <div className="aspect-[5/16] bg-muted rounded flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">-</p>
                      </div>
                    )}
                    
                    {backPhoto ? (
                      <div className="space-y-1">
                        <img 
                          src={backPhoto} 
                          alt="Back"
                          className="w-full aspect-[5/16] object-contain rounded bg-muted"
                        />
                        <p className="text-xs text-center text-muted-foreground">Back</p>
                      </div>
                    ) : (
                      <div className="aspect-[5/16] bg-muted rounded flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">-</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {measurement.weight !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gewicht:</span>
                        <span className="font-medium">{measurement.weight} kg</span>
                      </div>
                    )}
                    {measurement.shoulder_cm !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Schouders:</span>
                        <span className="font-medium">{measurement.shoulder_cm} cm</span>
                      </div>
                    )}
                    {measurement.chest_cm !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Borst:</span>
                        <span className="font-medium">{measurement.chest_cm} cm</span>
                      </div>
                    )}
                    {measurement.waist_cm !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taille:</span>
                        <span className="font-medium">{measurement.waist_cm} cm</span>
                      </div>
                    )}
                    {measurement.hips_cm !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Heupen:</span>
                        <span className="font-medium">{measurement.hips_cm} cm</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}