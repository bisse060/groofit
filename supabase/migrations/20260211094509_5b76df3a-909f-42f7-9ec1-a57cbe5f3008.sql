
-- Drop the restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Users can view only their own fitbit credentials" ON public.fitbit_credentials;

CREATE POLICY "Users can view own fitbit credentials"
ON public.fitbit_credentials
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
