-- 1. Make workout-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'workout-photos';

-- 2. Drop open SELECT policy and create owner-only policy
DROP POLICY IF EXISTS "Anyone can view workout photos" ON storage.objects;
CREATE POLICY "Users can view own workout photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'workout-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Revoke encrypt/decrypt function access from authenticated users
REVOKE EXECUTE ON FUNCTION public.encrypt_token(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(TEXT) FROM authenticated;

-- 4. Move pgcrypto extension to a dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;