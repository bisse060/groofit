
-- Add rating (1-5), photo_url, and is_template to workouts
ALTER TABLE public.workouts 
ADD COLUMN IF NOT EXISTS rating integer CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS photo_url text,
ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

-- Create storage bucket for workout photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('workout-photos', 'workout-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for workout photos
CREATE POLICY "Anyone can view workout photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'workout-photos');

CREATE POLICY "Users can upload own workout photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'workout-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own workout photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'workout-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own workout photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'workout-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
