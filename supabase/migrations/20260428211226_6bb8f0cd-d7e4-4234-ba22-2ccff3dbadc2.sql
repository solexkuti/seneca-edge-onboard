-- Persist the Strategy Builder's current step on the blueprint itself
-- so the multi-step session survives refresh and never restarts at step 0.
ALTER TABLE public.strategy_blueprints
  ADD COLUMN IF NOT EXISTS current_step text NOT NULL DEFAULT 'account';