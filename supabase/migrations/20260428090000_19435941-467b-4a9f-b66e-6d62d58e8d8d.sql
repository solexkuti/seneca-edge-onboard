ALTER TABLE public.strategy_blueprints
ADD COLUMN IF NOT EXISTS tier_rules jsonb NOT NULL DEFAULT '{"a_plus":"","b_plus":"","c":""}'::jsonb;