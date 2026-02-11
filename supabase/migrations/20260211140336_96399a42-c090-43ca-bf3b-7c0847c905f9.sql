-- Create food_logs table for daily nutrition tracking
CREATE TABLE public.food_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL DEFAULT 'snack',
  food_name TEXT NOT NULL,
  brand TEXT,
  fatsecret_food_id TEXT,
  serving_description TEXT,
  serving_size NUMERIC,
  calories NUMERIC DEFAULT 0,
  protein_g NUMERIC DEFAULT 0,
  carbs_g NUMERIC DEFAULT 0,
  fat_g NUMERIC DEFAULT 0,
  fiber_g NUMERIC DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies (permissive)
CREATE POLICY "Users can view own food logs"
ON public.food_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food logs"
ON public.food_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food logs"
ON public.food_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food logs"
ON public.food_logs FOR DELETE
USING (auth.uid() = user_id);

-- Admins
CREATE POLICY "Admins can manage all food logs"
ON public.food_logs FOR ALL
USING (is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_food_logs_updated_at
BEFORE UPDATE ON public.food_logs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Index for performance
CREATE INDEX idx_food_logs_user_date ON public.food_logs(user_id, log_date);