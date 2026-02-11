
-- Add heart rate, heart rate zones, and active minutes columns to daily_logs
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS resting_heart_rate integer,
  ADD COLUMN IF NOT EXISTS heart_rate_fat_burn_minutes integer,
  ADD COLUMN IF NOT EXISTS heart_rate_cardio_minutes integer,
  ADD COLUMN IF NOT EXISTS heart_rate_peak_minutes integer,
  ADD COLUMN IF NOT EXISTS active_minutes_lightly integer,
  ADD COLUMN IF NOT EXISTS active_minutes_fairly integer,
  ADD COLUMN IF NOT EXISTS active_minutes_very integer,
  ADD COLUMN IF NOT EXISTS distance_km numeric;
