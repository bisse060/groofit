
-- Create storage bucket for exercise images
INSERT INTO storage.buckets (id, name, public) VALUES ('exercise-images', 'exercise-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload their own exercise images (folder = user_id)
CREATE POLICY "Users can upload exercise images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exercise-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: users can view their own exercise images
CREATE POLICY "Users can view own exercise images"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: users can delete their own exercise images
CREATE POLICY "Users can delete own exercise images"
ON storage.objects FOR DELETE
USING (bucket_id = 'exercise-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: users can update their own exercise images
CREATE POLICY "Users can update own exercise images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'exercise-images' AND auth.uid()::text = (storage.foldername(name))[1]);
