-- Extend profiles table with Fitbit integration fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fitbit_user_id text,
ADD COLUMN IF NOT EXISTS fitbit_access_token text,
ADD COLUMN IF NOT EXISTS fitbit_refresh_token text,
ADD COLUMN IF NOT EXISTS fitbit_token_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS fitbit_scope text,
ADD COLUMN IF NOT EXISTS fitbit_connected_at timestamptz,
ADD COLUMN IF NOT EXISTS fitbit_last_sync_at timestamptz;

-- Create fitbit_sync_logs table for debugging
CREATE TABLE IF NOT EXISTS public.fitbit_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_date date NOT NULL,
  status text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fitbit_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for fitbit_sync_logs
CREATE POLICY "Users can view own sync logs"
  ON public.fitbit_sync_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync logs"
  ON public.fitbit_sync_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create oauth_states table for OAuth flow
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  state text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS policies for oauth_states
CREATE POLICY "Users can manage own oauth states"
  ON public.oauth_states
  FOR ALL
  USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_fitbit_sync_logs_user_date ON public.fitbit_sync_logs(user_id, sync_date);

-- Extend daily_logs with Fitbit sync tracking
ALTER TABLE public.daily_logs
ADD COLUMN IF NOT EXISTS synced_from_fitbit boolean DEFAULT false;