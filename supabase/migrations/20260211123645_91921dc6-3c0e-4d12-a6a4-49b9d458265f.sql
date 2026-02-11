
-- Drop the view approach - it won't work with security_invoker since SELECT policy is removed
DROP VIEW IF EXISTS public.fitbit_connection_status;

-- Create a security definer function that only returns non-sensitive fields
CREATE OR REPLACE FUNCTION public.get_fitbit_connection_status(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  fitbit_user_id text,
  connected_at timestamptz,
  last_sync_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, fitbit_user_id, connected_at, last_sync_at
  FROM public.fitbit_credentials
  WHERE user_id = p_user_id AND p_user_id = auth.uid();
$$;
