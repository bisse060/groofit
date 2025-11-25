-- Create table to track historical sync progress
CREATE TABLE IF NOT EXISTS public.fitbit_sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_days INTEGER NOT NULL,
  days_synced INTEGER DEFAULT 0,
  current_day_offset INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.fitbit_sync_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own sync progress
CREATE POLICY "Users can view own sync progress"
  ON public.fitbit_sync_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sync progress
CREATE POLICY "Users can insert own sync progress"
  ON public.fitbit_sync_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sync progress
CREATE POLICY "Users can update own sync progress"
  ON public.fitbit_sync_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_fitbit_sync_progress_user_status 
  ON public.fitbit_sync_progress(user_id, status);

CREATE INDEX IF NOT EXISTS idx_fitbit_sync_progress_status 
  ON public.fitbit_sync_progress(status);

-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;