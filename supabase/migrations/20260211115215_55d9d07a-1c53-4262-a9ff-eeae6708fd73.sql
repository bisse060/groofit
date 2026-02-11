
-- Fix measurements: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage all measurements" ON public.measurements;
DROP POLICY IF EXISTS "Users can view own measurements" ON public.measurements;
DROP POLICY IF EXISTS "Users can insert own measurements" ON public.measurements;
DROP POLICY IF EXISTS "Users can update own measurements" ON public.measurements;
DROP POLICY IF EXISTS "Users can delete own measurements" ON public.measurements;

CREATE POLICY "Users can view own measurements" ON public.measurements
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all measurements" ON public.measurements
FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Users can insert own measurements" ON public.measurements
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements" ON public.measurements
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurements" ON public.measurements
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all measurements" ON public.measurements
FOR ALL USING (is_admin(auth.uid()));
