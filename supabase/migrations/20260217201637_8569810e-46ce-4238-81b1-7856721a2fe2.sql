
-- Create user_feature_flags table
CREATE TABLE public.user_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_key text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, feature_key)
);

ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;

-- Users can view their own flags
CREATE POLICY "Users can view own feature flags"
ON public.user_feature_flags
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all feature flags
CREATE POLICY "Admins can manage all feature flags"
ON public.user_feature_flags
FOR ALL
USING (public.is_admin(auth.uid()));

-- Create performance_cycles table
CREATE TABLE public.performance_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text,
  cycle_type text, -- cut | bulk | maintenance | recomp | strength | custom
  start_date date NOT NULL,
  end_date date,
  goal text,
  notes text,
  baseline_snapshot jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;

-- Helper function to check feature flag
CREATE OR REPLACE FUNCTION public.has_feature_flag(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_feature_flags
    WHERE user_id = _user_id
      AND feature_key = _feature_key
      AND enabled = true
  )
$$;

-- Users with cycle_support flag can manage their own cycles
CREATE POLICY "Users can view own cycles"
ON public.performance_cycles
FOR SELECT
USING (auth.uid() = user_id AND public.has_feature_flag(auth.uid(), 'cycle_support'));

CREATE POLICY "Users can insert own cycles"
ON public.performance_cycles
FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.has_feature_flag(auth.uid(), 'cycle_support'));

CREATE POLICY "Users can update own cycles"
ON public.performance_cycles
FOR UPDATE
USING (auth.uid() = user_id AND public.has_feature_flag(auth.uid(), 'cycle_support'));

CREATE POLICY "Users can delete own cycles"
ON public.performance_cycles
FOR DELETE
USING (auth.uid() = user_id AND public.has_feature_flag(auth.uid(), 'cycle_support'));

-- Admins can manage all cycles
CREATE POLICY "Admins can manage all cycles"
ON public.performance_cycles
FOR ALL
USING (public.is_admin(auth.uid()));
