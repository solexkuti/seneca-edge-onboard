-- Index for fast per-user, newest-first reads (Dashboard, Mentor, Alerts).
CREATE INDEX IF NOT EXISTS idx_trades_user_executed_at
  ON public.trades (user_id, executed_at DESC);

-- Function: mirror an inserted trade_logs row into the canonical trades table.
-- Idempotent — skips if a matching trade already exists for the same user,
-- timestamp, and pair. Failures never block the originating trade_logs insert.
CREATE OR REPLACE FUNCTION public.mirror_trade_log_to_trades()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists uuid;
BEGIN
  -- Already mirrored? skip.
  SELECT id INTO v_exists
    FROM public.trades
   WHERE user_id = NEW.user_id
     AND executed_at = NEW.opened_at
     AND market = NEW.pair
   LIMIT 1;

  IF v_exists IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.trades (
    user_id, source, market, market_type, asset, direction, trade_type,
    entry_price, exit_price, stop_loss, take_profit, rr, risk_r, pnl,
    result, session, executed_at, closed_at, rules_broken, rules_followed,
    screenshot_url, notes
  ) VALUES (
    NEW.user_id,
    'manual'::trade_source,
    NEW.pair,
    CASE WHEN NEW.market IN ('forex','crypto') THEN NEW.market::market_type ELSE NULL END,
    NEW.pair,
    CASE WHEN NEW.direction = 'buy' THEN 'long'::trade_direction ELSE 'short'::trade_direction END,
    'executed'::trade_kind,
    NEW.entry_price, NEW.exit_price, NEW.stop_loss, NEW.take_profit,
    NEW.rr, NEW.risk_percent, NEW.pnl,
    CASE
      WHEN NEW.outcome = 'win' THEN 'win'::trade_result
      WHEN NEW.outcome = 'loss' THEN 'loss'::trade_result
      WHEN NEW.outcome = 'breakeven' THEN 'breakeven'::trade_result
      ELSE NULL
    END,
    CASE WHEN NEW.session_tag IN ('London','NY','Asia') THEN NEW.session_tag::trade_session ELSE NULL END,
    NEW.opened_at,
    NEW.closed_at,
    COALESCE(NEW.mistakes, '{}'::text[]),
    CASE WHEN NEW.rules_followed THEN ARRAY['clean_execution']::text[] ELSE '{}'::text[] END,
    NEW.screenshot_url,
    NEW.note
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'mirror_trade_log_to_trades failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_trade_log_to_trades ON public.trade_logs;
CREATE TRIGGER trg_mirror_trade_log_to_trades
AFTER INSERT ON public.trade_logs
FOR EACH ROW
EXECUTE FUNCTION public.mirror_trade_log_to_trades();

-- Backfill any legacy trade_logs that still don't have a canonical trades row.
INSERT INTO public.trades (
  user_id, source, market, market_type, asset, direction, trade_type,
  entry_price, exit_price, stop_loss, take_profit, rr, risk_r, pnl,
  result, session, executed_at, closed_at, rules_broken, rules_followed,
  screenshot_url, notes
)
SELECT
  tl.user_id,
  'manual'::trade_source,
  tl.pair,
  CASE WHEN tl.market IN ('forex','crypto') THEN tl.market::market_type ELSE NULL END,
  tl.pair,
  CASE WHEN tl.direction = 'buy' THEN 'long'::trade_direction ELSE 'short'::trade_direction END,
  'executed'::trade_kind,
  tl.entry_price, tl.exit_price, tl.stop_loss, tl.take_profit,
  tl.rr, tl.risk_percent, tl.pnl,
  CASE
    WHEN tl.outcome = 'win' THEN 'win'::trade_result
    WHEN tl.outcome = 'loss' THEN 'loss'::trade_result
    WHEN tl.outcome = 'breakeven' THEN 'breakeven'::trade_result
    ELSE NULL
  END,
  CASE WHEN tl.session_tag IN ('London','NY','Asia') THEN tl.session_tag::trade_session ELSE NULL END,
  tl.opened_at,
  tl.closed_at,
  COALESCE(tl.mistakes, '{}'::text[]),
  CASE WHEN tl.rules_followed THEN ARRAY['clean_execution']::text[] ELSE '{}'::text[] END,
  tl.screenshot_url,
  tl.note
FROM public.trade_logs tl
LEFT JOIN public.trades t
  ON t.user_id = tl.user_id
 AND t.executed_at = tl.opened_at
 AND t.market = tl.pair
WHERE t.id IS NULL;