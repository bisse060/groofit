CREATE POLICY "Users can view their own fitbit credentials"
ON public.fitbit_credentials
FOR SELECT
USING (auth.uid() = user_id);