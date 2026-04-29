-- Trade Performance Engine: dedicated trade_logs table
CREATE TABLE IF NOT EXISTS public.trade_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,

  -- TRADE CORE
  market TEXT NOT NULL,                 -- e.g. forex, crypto, indices, stocks
  pair TEXT NOT NULL,                   -- e.g. EURUSD, BTCUSD, NAS100
  direction TEXT NOT NULL CHECK (direction IN ('buy','sell')),
  entry_price NUMERIC,
  exit_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  risk_percent NUMERIC,

  -- PERFORMANCE
  rr NUMERIC,                           -- risk:reward (signed: +R win, -R loss)
  pnl NUMERIC,                          -- absolute money result
  pnl_percent NUMERIC,                  -- % of account
  outcome TEXT NOT NULL CHECK (outcome IN ('win','loss','breakeven')),

  -- TIMING
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  timezone TEXT,                        -- IANA tz of the trader, e.g. Europe/Lisbon
  session_tag TEXT,                     -- London | NY | Asia | Sydney | Other

  -- BEHAVIOR
  rules_followed BOOLEAN NOT NULL DEFAULT TRUE,
  mistakes TEXT[] NOT NULL DEFAULT '{}',
  confidence_rating SMALLINT CHECK (confidence_rating BETWEEN 1 AND 5),
  emotional_state TEXT,

  -- JOURNAL
  note TEXT,
  screenshot_url TEXT,

  -- SYSTEM
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trade_logs_user_opened
  ON public.trade_logs (user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_logs_user_created
  ON public.trade_logs (user_id, created_at DESC);

-- updated_at trigger (reuses existing public.set_updated_at)
DROP TRIGGER IF EXISTS trg_trade_logs_set_updated_at ON public.trade_logs;
CREATE TRIGGER trg_trade_logs_set_updated_at
BEFORE UPDATE ON public.trade_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- closed_at must not precede opened_at
CREATE OR REPLACE FUNCTION public.validate_trade_log_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND NEW.closed_at < NEW.opened_at THEN
    RAISE EXCEPTION 'closed_at (%) cannot be before opened_at (%)',
      NEW.closed_at, NEW.opened_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_logs_validate_dates ON public.trade_logs;
CREATE TRIGGER trg_trade_logs_validate_dates
BEFORE INSERT OR UPDATE ON public.trade_logs
FOR EACH ROW
EXECUTE FUNCTION public.validate_trade_log_dates();

-- RLS
ALTER TABLE public.trade_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trade logs"
ON public.trade_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own trade logs"
ON public.trade_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own trade logs"
ON public.trade_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own trade logs"
ON public.trade_logs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);