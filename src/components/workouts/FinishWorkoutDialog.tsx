import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Camera, Instagram, Save, Clock, Dumbbell } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';

interface FinishWorkoutDialogProps {
  open: boolean;
  onClose: () => void;
  onFinish: (data: { rating: number; notes: string; photo: File | null; saveAsTemplate: boolean }) => void;
  startTime: string | null;
  workoutTitle: string | null;
  totalSets: number;
  totalVolume: number;
  exerciseCount: number;
}

export default function FinishWorkoutDialog({
  open,
  onClose,
  onFinish,
  startTime,
  workoutTitle,
  totalSets,
  totalVolume,
  exerciseCount,
}: FinishWorkoutDialogProps) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const duration = startTime ? differenceInMinutes(new Date(), new Date(startTime)) : 0;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinish = () => {
    onFinish({ rating, notes, photo, saveAsTemplate });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Workout Afronden 🎉</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-muted rounded-lg">
              <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-semibold tabular-nums">{duration}</p>
              <p className="text-[10px] text-muted-foreground">minuten</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <Dumbbell className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-semibold tabular-nums">{totalSets}</p>
              <p className="text-[10px] text-muted-foreground">sets</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <p className="text-lg font-semibold tabular-nums">{Math.round(totalVolume).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">kg volume</p>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <Label className="text-sm">Hoe was je training?</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star className={`h-7 w-7 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm">Notities (optioneel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hoe voelde de training? Bijzonderheden?"
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Photo */}
          <div className="space-y-1.5">
            <Label className="text-sm">Foto (optioneel)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Workout foto" className="w-full h-32 object-cover rounded-lg" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-1 right-1 h-6 text-xs"
                  onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                >
                  Verwijder
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" />
                Voeg foto toe
              </Button>
            )}
          </div>

          {/* Save as template */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Opslaan als routine voor volgende keer</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuleer
            </Button>
            <Button onClick={handleFinish} className="flex-1">
              Afronden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
