
-- Subscription tiers referentietabel
CREATE TABLE public.subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  features text[] NOT NULL DEFAULT '{}',
  price_monthly numeric DEFAULT 0,
  price_yearly numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tiers" ON public.subscription_tiers
  FOR SELECT TO authenticated USING (true);

-- Seed tiers
INSERT INTO public.subscription_tiers (name, display_name, description, features, sort_order) VALUES
  ('free', 'Free', 'Basistoegang tot voortgang', ARRAY['progress'], 0),
  ('plus', 'Plus', 'Inclusief wearable koppelingen', ARRAY['progress','wearables'], 1),
  ('pro', 'Pro', 'Trainingen en AI analyses', ARRAY['progress','wearables','workouts','ai_analysis'], 2),
  ('coach', 'Coach', 'Coaching module', ARRAY['progress','wearables','workouts','ai_analysis','coaching'], 3),
  ('tester', 'Tester', 'Volledige toegang inclusief beta functies', ARRAY['progress','wearables','workouts','ai_analysis','coaching','beta'], 4);

-- User subscriptions
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier_id uuid NOT NULL REFERENCES public.subscription_tiers(id),
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Admins manage all subscriptions" ON public.user_subscriptions
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users insert own subscription" ON public.user_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Update handle_new_user to also assign free tier
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  free_tier_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Assign free subscription tier
  SELECT id INTO free_tier_id FROM public.subscription_tiers WHERE name = 'free';
  IF free_tier_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, tier_id)
    VALUES (NEW.id, free_tier_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Backfill existing users with free tier
INSERT INTO public.user_subscriptions (user_id, tier_id)
SELECT u.id, t.id
FROM auth.users u
CROSS JOIN public.subscription_tiers t
WHERE t.name = 'free'
AND NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = u.id
);
