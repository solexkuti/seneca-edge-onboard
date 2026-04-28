-- Strategy Builder companion table
CREATE TABLE public.strategy_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Strategy',

  -- Step 1: Account Type (multi-select)
  account_types TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'prop','personal','demo'}

  -- Step 2: Risk Profile
  risk_per_trade_pct NUMERIC(5,2),     -- e.g. 0.50
  daily_loss_limit_pct NUMERIC(5,2),   -- e.g. 3.00
  max_drawdown_pct NUMERIC(5,2),       -- e.g. 10.00

  -- Step 3: Raw input (free text)
  raw_input TEXT,

  -- Step 4: Tier strictness sliders (0-100 each)
  tier_strictness JSONB NOT NULL DEFAULT '{"a_plus": 100, "b_plus": 80, "c": 60}'::jsonb,

  -- Step 5: AI-parsed structured rules
  -- Shape: { entry: string[], confirmation: string[], risk: string[], behavior: string[], context: string[] }
  structured_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ambiguity_flags JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Step 6: Refinement Q&A
  -- Shape: [{ question, answer, accepted }]
  refinement_history JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Step 7: Outputs
  -- Shape: { a_plus: string[], b_plus: string[], c: string[] } (binary yes/no items)
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  trading_plan TEXT,

  -- Step 9: Lock
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,

  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | parsed | refined | finalized | locked

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategy_blueprints_user ON public.strategy_blueprints(user_id, created_at DESC);
CREATE INDEX idx_strategy_blueprints_strategy ON public.strategy_blueprints(strategy_id);

ALTER TABLE public.strategy_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blueprints"
  ON public.strategy_blueprints FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blueprints"
  ON public.strategy_blueprints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blueprints"
  ON public.strategy_blueprints FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own blueprints"
  ON public.strategy_blueprints FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_strategy_blueprints_updated
  BEFORE UPDATE ON public.strategy_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();