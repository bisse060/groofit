-- Create workouts table
CREATE TABLE IF NOT EXISTS public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body_part TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Create workout_exercises junction table
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create workout_sets table
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  weight NUMERIC(6,2),
  reps INT,
  rir INT,
  is_warmup BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workouts
CREATE POLICY "Users select own workouts"
ON public.workouts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own workouts"
ON public.workouts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own workouts"
ON public.workouts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own workouts"
ON public.workouts FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for exercises
CREATE POLICY "Users select own exercises"
ON public.exercises FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own exercises"
ON public.exercises FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own exercises"
ON public.exercises FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own exercises"
ON public.exercises FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for workout_exercises
CREATE POLICY "Users select own workout_exercises"
ON public.workout_exercises FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workouts
    WHERE workouts.id = workout_exercises.workout_id
    AND workouts.user_id = auth.uid()
  )
);

CREATE POLICY "Users insert own workout_exercises"
ON public.workout_exercises FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workouts
    WHERE workouts.id = workout_exercises.workout_id
    AND workouts.user_id = auth.uid()
  )
);

CREATE POLICY "Users update own workout_exercises"
ON public.workout_exercises FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workouts
    WHERE workouts.id = workout_exercises.workout_id
    AND workouts.user_id = auth.uid()
  )
);

CREATE POLICY "Users delete own workout_exercises"
ON public.workout_exercises FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workouts
    WHERE workouts.id = workout_exercises.workout_id
    AND workouts.user_id = auth.uid()
  )
);

-- RLS Policies for workout_sets
CREATE POLICY "Users select own workout_sets"
ON public.workout_sets FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Users insert own workout_sets"
ON public.workout_sets FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Users update own workout_sets"
ON public.workout_sets FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Users delete own workout_sets"
ON public.workout_sets FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id
    AND w.user_id = auth.uid()
  )
);

-- Add trigger for updated_at on workouts
CREATE TRIGGER update_workouts_updated_at
BEFORE UPDATE ON public.workouts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();