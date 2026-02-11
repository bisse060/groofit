
-- Table for storing per-user FatSecret OAuth 1.0a tokens
CREATE TABLE public.fatsecret_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  oauth_token text NOT NULL,
  oauth_secret text NOT NULL,
  fatsecret_user_id text,
  connected_at timestamp with time zone DEFAULT now(),
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fatsecret_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies (permissive per project convention)
CREATE POLICY "Users can view own fatsecret credentials"
  ON public.fatsecret_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fatsecret credentials"
  ON public.fatsecret_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fatsecret credentials"
  ON public.fatsecret_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fatsecret credentials"
  ON public.fatsecret_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Secure RPC to check connection status without exposing tokens
CREATE OR REPLACE FUNCTION public.get_fatsecret_connection_status(p_user_id uuid)
RETURNS TABLE(id uuid, fatsecret_user_id text, connected_at timestamptz, last_sync_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, fatsecret_user_id, connected_at, last_sync_at
  FROM public.fatsecret_credentials
  WHERE user_id = p_user_id AND p_user_id = auth.uid();
$$;
