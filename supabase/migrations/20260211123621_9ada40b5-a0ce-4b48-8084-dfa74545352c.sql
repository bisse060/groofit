
-- Create a secure view that only exposes non-sensitive fields
CREATE VIEW public.fitbit_connection_status AS
SELECT 
  id,
  user_id,
  fitbit_user_id,
  connected_at,
  last_sync_at
FROM public.fitbit_credentials
WHERE auth.uid() = user_id;

-- Drop the existing SELECT policy that exposes tokens
DROP POLICY IF EXISTS "Users can view own fitbit credentials" ON public.fitbit_credentials;

-- Create a restrictive SELECT policy that only allows service_role access
-- (edge functions use service_role_key which bypasses RLS, so no policy needed for them)
-- Users can still INSERT, UPDATE, DELETE their own credentials via existing policies
-- but cannot SELECT (read) the tokens from client-side
