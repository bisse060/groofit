
-- Fix security definer view - make it use invoker's permissions
ALTER VIEW public.fitbit_connection_status SET (security_invoker = true);
