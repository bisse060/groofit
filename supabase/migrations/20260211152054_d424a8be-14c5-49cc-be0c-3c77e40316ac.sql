
-- Create a simple config table for internal secrets
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS - no public access
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no one can read via API, only via service role or SQL

-- Store cron auth secret
INSERT INTO public.app_config (key, value) 
VALUES ('cron_auth_secret', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

-- Drop old cron jobs  
SELECT cron.unschedule('fitbit-auto-sync-daily');
SELECT cron.unschedule('fitbit-incremental-sync-hourly');

-- Recreate cron jobs reading secret from config table
SELECT cron.schedule(
  'fitbit-auto-sync-daily',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://bizhoajrqpvnamixlfns.supabase.co/functions/v1/fitbit-auto-sync',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'cron_auth_secret')
        ),
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'fitbit-incremental-sync-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://bizhoajrqpvnamixlfns.supabase.co/functions/v1/fitbit-sync-incremental',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'cron_auth_secret')
        ),
        body:='{}'::jsonb
    ) AS request_id;
  $$
);
