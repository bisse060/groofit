-- Add tags column to daily_logs table
ALTER TABLE public.daily_logs 
ADD COLUMN tags text[] DEFAULT ARRAY[]::text[];