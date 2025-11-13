-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table (separate from profiles!)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  current_weight decimal,
  target_weight decimal,
  height_cm integer,
  goals text,
  avatar_url text,
  instagram_username text,
  fitbit_access_token text,
  fitbit_refresh_token text,
  fitbit_user_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create daily_logs table
CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date date NOT NULL,
  steps integer,
  workout_completed boolean DEFAULT false,
  calorie_intake integer,
  calorie_burn integer,
  weight decimal,
  body_fat_percentage decimal,
  notes text,
  synced_from_fitbit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- Create measurements table
CREATE TABLE public.measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  measurement_date date NOT NULL,
  weight decimal,
  chest_cm decimal,
  waist_cm decimal,
  hips_cm decimal,
  bicep_left_cm decimal,
  bicep_right_cm decimal,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false);

-- Create progress_photos table
CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  measurement_id uuid REFERENCES public.measurements(id) ON DELETE CASCADE NOT NULL,
  photo_date date NOT NULL,
  photo_type text CHECK (photo_type IN ('front', 'side', 'back')) NOT NULL,
  photo_url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for daily_logs
CREATE POLICY "Users can view own logs"
  ON public.daily_logs FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own logs"
  ON public.daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
  ON public.daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs"
  ON public.daily_logs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all logs"
  ON public.daily_logs FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for measurements
CREATE POLICY "Users can view own measurements"
  ON public.measurements FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own measurements"
  ON public.measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements"
  ON public.measurements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurements"
  ON public.measurements FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all measurements"
  ON public.measurements FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for progress_photos
CREATE POLICY "Users can view own photos"
  ON public.progress_photos FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own photos"
  ON public.progress_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos"
  ON public.progress_photos FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all photos"
  ON public.progress_photos FOR ALL
  USING (public.is_admin(auth.uid()));

-- Storage policies for progress-photos bucket
CREATE POLICY "Users can view own photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'progress-photos' AND public.is_admin(auth.uid()));

-- Trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();