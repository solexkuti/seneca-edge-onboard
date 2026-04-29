-- Add explicit onboarding_completed flag to profiles for first-time vs returning user detection.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Backfill: anyone who already finished onboarding (has onboarded_at set) is marked complete.
UPDATE public.profiles
   SET onboarding_completed = true
 WHERE onboarded_at IS NOT NULL
   AND onboarding_completed = false;