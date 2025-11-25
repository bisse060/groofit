-- Extend exercises table with additional fields
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS instructions TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
ADD COLUMN IF NOT EXISTS equipment TEXT,
ADD COLUMN IF NOT EXISTS primary_muscles TEXT[],
ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[];

-- Update body_part to be more structured (optional, for existing data)
COMMENT ON COLUMN public.exercises.body_part IS 'Primary body part: chest, back, shoulders, arms, legs, core, full_body';
COMMENT ON COLUMN public.exercises.primary_muscles IS 'Array of primary muscles worked';
COMMENT ON COLUMN public.exercises.secondary_muscles IS 'Array of secondary muscles worked';
COMMENT ON COLUMN public.exercises.difficulty IS 'Difficulty level: beginner, intermediate, advanced';
COMMENT ON COLUMN public.exercises.equipment IS 'Required equipment (e.g., barbell, dumbbell, bodyweight)';
COMMENT ON COLUMN public.exercises.instructions IS 'Step-by-step instructions for performing the exercise';
COMMENT ON COLUMN public.exercises.image_url IS 'URL to exercise demonstration image';
COMMENT ON COLUMN public.exercises.video_url IS 'URL to exercise demonstration video';