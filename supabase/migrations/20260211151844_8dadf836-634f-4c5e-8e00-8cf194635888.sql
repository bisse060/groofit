
-- Fix cron jobs: use service_role key instead of anon key
-- The edge functions check for service_role_key authorization

SELECT cron.unschedule('fitbit-auto-sync-daily');
SELECT cron.unschedule('fitbit-incremental-sync-hourly');

-- Re-create with correct service role key reference
-- We use the vault to get the service role key securely
SELECT cron.schedule(
  'fitbit-auto-sync-daily',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://bizhoajrqpvnamixlfns.supabase.co/functions/v1/fitbit-auto-sync',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
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
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body:='{}'::jsonb
    ) AS request_id;
  $$
);
