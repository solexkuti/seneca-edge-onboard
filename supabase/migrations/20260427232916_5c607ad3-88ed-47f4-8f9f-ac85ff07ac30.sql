-- =========================================================================
-- ENUMS — keep values constrained so analytics & AI mentor stay reliable
-- =========================================================================
CREATE TYPE public.trade_direction AS ENUM ('long', 'short');
CREATE TYPE public.trade_result AS ENUM ('win', 'loss', 'breakeven');
CREATE TYPE public.emotional_state AS ENUM (
  'frustrated', 'fearful', 'overconfident', 'neutral', 'confused'
);

-- =========================================================================
-- STRATEGIES — the user's playbook (rules they commit to follow)
-- =========================================================================
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entry_rule TEXT,
  exit_rule TEXT,
  risk_rule TEXT,
  behavior_rule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX strategies_user_id_idx ON public.strategies (user_id);
CREATE INDEX strategies_user_active_idx
  ON public.strategies (user_id) WHERE is_active;

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategies"
  ON public.strategies FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own strategies"
  ON public.strategies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own strategies"
  ON public.strategies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own strategies"
  ON public.strategies FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER strategies_set_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- TRADES — the execution record (linked optionally to a strategy)
-- =========================================================================
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  market TEXT NOT NULL,
  direction public.trade_direction NOT NULL,
  entry_price NUMERIC(20, 8),
  stop_loss NUMERIC(20, 8),
  take_profit NUMERIC(20, 8),
  result public.trade_result,
  rr NUMERIC(10, 4),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX trades_user_id_idx ON public.trades (user_id);
CREATE INDEX trades_user_executed_idx
  ON public.trades (user_id, executed_at DESC);
CREATE INDEX trades_strategy_id_idx ON public.trades (strategy_id);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades"
  ON public.trades FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades"
  ON public.trades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades"
  ON public.trades FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades"
  ON public.trades FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trades_set_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validation: closed_at (when set) must not predate executed_at.
-- Done via trigger (not CHECK) per project rules — keeps things flexible.
CREATE OR REPLACE FUNCTION public.validate_trade_dates()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND NEW.closed_at < NEW.executed_at THEN
    RAISE EXCEPTION 'closed_at (%) cannot be before executed_at (%)',
      NEW.closed_at, NEW.executed_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_trade_dates()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trades_validate_dates
  BEFORE INSERT OR UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.validate_trade_dates();

-- =========================================================================
-- DISCIPLINE_LOGS — the behavior signal (1 per trade, score auto-computed)
-- =========================================================================
CREATE TABLE public.discipline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID UNIQUE REFERENCES public.trades(id) ON DELETE CASCADE,
  followed_entry BOOLEAN NOT NULL DEFAULT false,
  followed_exit BOOLEAN NOT NULL DEFAULT false,
  followed_risk BOOLEAN NOT NULL DEFAULT false,
  followed_behavior BOOLEAN NOT NULL DEFAULT false,
  discipline_score INTEGER NOT NULL DEFAULT 0
    CHECK (discipline_score BETWEEN 0 AND 100),
  emotional_state public.emotional_state,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX discipline_logs_user_id_idx ON public.discipline_logs (user_id);
CREATE INDEX discipline_logs_user_created_idx
  ON public.discipline_logs (user_id, created_at DESC);
CREATE INDEX discipline_logs_emotional_state_idx
  ON public.discipline_logs (user_id, emotional_state)
  WHERE emotional_state IS NOT NULL;

ALTER TABLE public.discipline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discipline logs"
  ON public.discipline_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own discipline logs"
  ON public.discipline_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own discipline logs"
  ON public.discipline_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own discipline logs"
  ON public.discipline_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-compute discipline_score = (entry + exit + risk + behavior) × 25.
-- Single source of truth so dashboard, AI mentor, and pattern detection
-- never disagree about what a "score" means.
CREATE OR REPLACE FUNCTION public.compute_discipline_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.discipline_score :=
    (CASE WHEN NEW.followed_entry THEN 1 ELSE 0 END +
     CASE WHEN NEW.followed_exit THEN 1 ELSE 0 END +
     CASE WHEN NEW.followed_risk THEN 1 ELSE 0 END +
     CASE WHEN NEW.followed_behavior THEN 1 ELSE 0 END) * 25;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.compute_discipline_score()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER discipline_logs_compute_score
  BEFORE INSERT OR UPDATE ON public.discipline_logs
  FOR EACH ROW EXECUTE FUNCTION public.compute_discipline_score();

-- =========================================================================
-- EMOTIONAL_EVENTS — standalone moments (revenge urge, hesitation, etc.)
-- =========================================================================
CREATE TABLE public.emotional_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state public.emotional_state NOT NULL,
  trigger TEXT,
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX emotional_events_user_created_idx
  ON public.emotional_events (user_id, created_at DESC);

ALTER TABLE public.emotional_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emotional events"
  ON public.emotional_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own emotional events"
  ON public.emotional_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own emotional events"
  ON public.emotional_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own emotional events"
  ON public.emotional_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);