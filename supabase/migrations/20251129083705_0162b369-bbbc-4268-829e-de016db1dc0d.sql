-- Step 1: Create secure fitbit_credentials table
CREATE TABLE IF NOT EXISTS public.fitbit_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  fitbit_user_id text,
  scope text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.fitbit_credentials IS 'Secure storage for Fitbit OAuth tokens - isolated from profiles for enhanced security';

-- Step 2: Enable RLS with strict owner-only access
ALTER TABLE public.fitbit_credentials ENABLE ROW LEVEL SECURITY;

-- Only the token owner can read their own credentials (no admin access)
CREATE POLICY "Users can view only their own fitbit credentials"
ON public.fitbit_credentials
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only the token owner can insert their credentials
CREATE POLICY "Users can insert their own fitbit credentials"
ON public.fitbit_credentials
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only the token owner can update their credentials
CREATE POLICY "Users can update their own fitbit credentials"
ON public.fitbit_credentials
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Only the token owner can delete their credentials
CREATE POLICY "Users can delete their own fitbit credentials"
ON public.fitbit_credentials
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 3: Migrate existing data from profiles to fitbit_credentials
INSERT INTO public.fitbit_credentials (
  user_id,
  access_token,
  refresh_token,
  fitbit_user_id,
  scope,
  token_expires_at,
  connected_at,
  last_sync_at
)
SELECT 
  id,
  fitbit_access_token,
  fitbit_refresh_token,
  fitbit_user_id,
  fitbit_scope,
  fitbit_token_expires_at,
  fitbit_connected_at,
  fitbit_last_sync_at
FROM public.profiles
WHERE fitbit_access_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  fitbit_user_id = EXCLUDED.fitbit_user_id,
  scope = EXCLUDED.scope,
  token_expires_at = EXCLUDED.token_expires_at,
  connected_at = EXCLUDED.connected_at,
  last_sync_at = EXCLUDED.last_sync_at;

-- Step 4: Add trigger for automatic timestamp updates
CREATE TRIGGER update_fitbit_credentials_updated_at
BEFORE UPDATE ON public.fitbit_credentials
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Step 5: Remove sensitive columns from profiles table
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS fitbit_access_token,
  DROP COLUMN IF EXISTS fitbit_refresh_token,
  DROP COLUMN IF EXISTS fitbit_user_id,
  DROP COLUMN IF EXISTS fitbit_scope,
  DROP COLUMN IF EXISTS fitbit_token_expires_at,
  DROP COLUMN IF EXISTS fitbit_connected_at,
  DROP COLUMN IF EXISTS fitbit_last_sync_at;