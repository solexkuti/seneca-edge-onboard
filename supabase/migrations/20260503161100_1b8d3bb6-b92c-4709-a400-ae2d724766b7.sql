-- ============================================================
-- rule_violations: normalized, impact-ranked rule break ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rule_violations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  trade_id    uuid NOT NULL,
  type        text NOT NULL,
  impact_r    numeric NOT NULL DEFAULT 0,
  session     text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_violations_user_idx       ON public.rule_violations (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rule_violations_user_type_idx  ON public.rule_violations (user_id, type);
CREATE INDEX IF NOT EXISTS rule_violations_trade_idx      ON public.rule_violations (trade_id);

ALTER TABLE public.rule_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rule violations"
  ON public.rule_violations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own rule violations"
  ON public.rule_violations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own rule violations"
  ON public.rule_violations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own rule violations"
  ON public.rule_violations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Sync function: rebuilds violations for a single trade row
-- Impact_R convention:
--   - if trade has a numeric risk_r and result = 'loss' -> impact = -|risk_r|
--   - if trade has rr and result = 'loss'                -> impact = -|rr|
--   - if pnl < 0                                          -> impact = pnl as R proxy / risk_r if known
--   - else                                                -> 0 (rule broken but no R lost yet)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_rule_violations_for_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule text;
  v_impact numeric;
  v_count int;
BEGIN
  -- Always rebuild for this trade so updates stay consistent
  DELETE FROM public.rule_violations WHERE trade_id = NEW.id;

  IF NEW.rules_broken IS NULL OR array_length(NEW.rules_broken, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_count := array_length(NEW.rules_broken, 1);

  -- Determine R impact: prefer explicit risk_r on a loss, else rr on a loss, else 0
  v_impact := CASE
    WHEN NEW.result = 'loss' AND NEW.risk_r IS NOT NULL THEN -ABS(NEW.risk_r)
    WHEN NEW.result = 'loss' AND NEW.rr     IS NOT NULL THEN -ABS(NEW.rr)
    WHEN NEW.pnl IS NOT NULL AND NEW.pnl < 0 AND NEW.risk_r IS NOT NULL AND NEW.risk_r <> 0
      THEN NEW.pnl / ABS(NEW.risk_r)
    ELSE 0
  END;

  -- Spread the loss evenly across the rules broken on this trade
  IF v_count > 0 AND v_impact <> 0 THEN
    v_impact := v_impact / v_count;
  END IF;

  FOREACH v_rule IN ARRAY NEW.rules_broken LOOP
    INSERT INTO public.rule_violations (user_id, trade_id, type, impact_r, session, occurred_at)
    VALUES (
      NEW.user_id,
      NEW.id,
      lower(trim(v_rule)),
      COALESCE(v_impact, 0),
      NEW.session::text,
      COALESCE(NEW.executed_at, NEW.created_at, now())
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_rule_violations_for_trade failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rule_violations_ins ON public.trades;
DROP TRIGGER IF EXISTS trg_sync_rule_violations_upd ON public.trades;

CREATE TRIGGER trg_sync_rule_violations_ins
AFTER INSERT ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.sync_rule_violations_for_trade();

CREATE TRIGGER trg_sync_rule_violations_upd
AFTER UPDATE OF rules_broken, result, risk_r, rr, pnl, session, executed_at
ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.sync_rule_violations_for_trade();

-- ============================================================
-- Backfill from existing trades.rules_broken
-- ============================================================
INSERT INTO public.rule_violations (user_id, trade_id, type, impact_r, session, occurred_at)
SELECT
  t.user_id,
  t.id,
  lower(trim(rule)),
  CASE
    WHEN t.result = 'loss' AND t.risk_r IS NOT NULL THEN -ABS(t.risk_r) / GREATEST(array_length(t.rules_broken, 1), 1)
    WHEN t.result = 'loss' AND t.rr     IS NOT NULL THEN -ABS(t.rr)     / GREATEST(array_length(t.rules_broken, 1), 1)
    WHEN t.pnl IS NOT NULL AND t.pnl < 0 AND t.risk_r IS NOT NULL AND t.risk_r <> 0
      THEN (t.pnl / ABS(t.risk_r)) / GREATEST(array_length(t.rules_broken, 1), 1)
    ELSE 0
  END,
  t.session::text,
  COALESCE(t.executed_at, t.created_at, now())
FROM public.trades t
CROSS JOIN LATERAL unnest(t.rules_broken) AS rule
WHERE t.rules_broken IS NOT NULL
  AND array_length(t.rules_broken, 1) IS NOT NULL
ON CONFLICT DO NOTHING;