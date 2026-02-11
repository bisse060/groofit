
-- Fix workout_exercises: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users select own workout_exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users insert own workout_exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users update own workout_exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users delete own workout_exercises" ON public.workout_exercises;

CREATE POLICY "Users select own workout_exercises" ON public.workout_exercises
FOR SELECT USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);

CREATE POLICY "Users insert own workout_exercises" ON public.workout_exercises
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);

CREATE POLICY "Users update own workout_exercises" ON public.workout_exercises
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);

CREATE POLICY "Users delete own workout_exercises" ON public.workout_exercises
FOR DELETE USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);

-- Fix workout_sets: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users select own workout_sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users insert own workout_sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users update own workout_sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users delete own workout_sets" ON public.workout_sets;

CREATE POLICY "Users select own workout_sets" ON public.workout_sets
FOR SELECT USING (
  EXISTS (SELECT 1 FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid())
);

CREATE POLICY "Users insert own workout_sets" ON public.workout_sets
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid())
);

CREATE POLICY "Users update own workout_sets" ON public.workout_sets
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid())
);

CREATE POLICY "Users delete own workout_sets" ON public.workout_sets
FOR DELETE USING (
  EXISTS (SELECT 1 FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid())
);
