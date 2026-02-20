
-- Add last_login and total_app_minutes to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS total_app_minutes integer NOT NULL DEFAULT 0;

-- Create a function admins can call to update session data (security definer)
CREATE OR REPLACE FUNCTION public.record_session(
  p_user_id uuid,
  p_duration_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    last_login_at = now(),
    total_app_minutes = COALESCE(total_app_minutes, 0) + GREATEST(p_duration_minutes, 0)
  WHERE id = p_user_id;
END;
$$;
