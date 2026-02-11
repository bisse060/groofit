import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import WatermarkedImage from '@/components/WatermarkedImage';

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

const photoTypeLabels: Record<string, string> = {
  front: 'Voorkant',
  side: 'Zijkant',
  back: 'Achterkant',
};

export default function TimelineView({ 
  measurements, 
  photosMap 
}: { 
  measurements: Measurement[];
  photosMap: Record<string, ProgressPhoto[]>;
}) {
  if (measurements.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Geen metingen beschikbaar</p>
        </CardContent>
      </Card>
    );
  }

  // Sort measurements from newest to oldest (they already come sorted this way)
  const sorted = [...measurements];

  const photoTypes = ['front', 'side', 'back'];

  return (
    <div className="space-y-6">
      {photoTypes.map((type) => {
        // Check if any measurement has this photo type
        const hasAny = sorted.some(m => {
          const photos = photosMap[m.id] || [];
          return photos.some(p => p.photo_type === type);
        });
        if (!hasAny) return null;

        return (
          <div key={type} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{photoTypeLabels[type]}</h3>
            <div className="overflow-x-auto">
              <div className="flex gap-3 pb-2 min-w-max">
                {sorted.map((measurement) => {
                  const photos = photosMap[measurement.id] || [];
                  const photo = photos.find(p => p.photo_type === type)?.photo_url;

                  return (
                    <div key={measurement.id} className="flex-shrink-0 w-28 md:w-36 space-y-1">
                      <p className="text-[10px] text-center text-muted-foreground font-medium">
                        {format(new Date(measurement.measurement_date), 'dd MMM yyyy')}
                      </p>
                      {photo ? (
                        <WatermarkedImage
                          src={photo}
                          alt={type}
                          className="w-full aspect-[3/5] object-contain rounded bg-muted"
                        />
                      ) : (
                        <div className="w-full aspect-[3/5] bg-muted rounded flex items-center justify-center">
                          <p className="text-[10px] text-muted-foreground">-</p>
                        </div>
                      )}
                      {measurement.weight !== null && (
                        <p className="text-[10px] text-center text-muted-foreground">
                          {measurement.weight} kg
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Measurements table below photos */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2 font-medium sticky left-0 bg-muted">Meting</th>
              {sorted.map(m => (
                <th key={m.id} className="text-right p-2 font-medium whitespace-nowrap">
                  {format(new Date(m.measurement_date), 'dd MMM')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { key: 'weight', label: 'Gewicht', unit: 'kg' },
              { key: 'shoulder_cm', label: 'Schouders', unit: 'cm' },
              { key: 'chest_cm', label: 'Borst', unit: 'cm' },
              { key: 'waist_cm', label: 'Taille', unit: 'cm' },
              { key: 'hips_cm', label: 'Heupen', unit: 'cm' },
            ].map(field => {
              const hasAny = sorted.some(m => m[field.key as keyof Measurement] !== null);
              if (!hasAny) return null;
              return (
                <tr key={field.key} className="border-t">
                  <td className="p-2 text-muted-foreground sticky left-0 bg-background">{field.label}</td>
                  {sorted.map(m => (
                    <td key={m.id} className="p-2 text-right font-medium whitespace-nowrap">
                      {m[field.key as keyof Measurement] !== null
                        ? `${m[field.key as keyof Measurement]}`
                        : '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
