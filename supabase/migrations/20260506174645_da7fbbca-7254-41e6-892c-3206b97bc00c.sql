ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS actual_risk_pct numeric,
  ADD COLUMN IF NOT EXISTS preferred_risk_pct numeric;

UPDATE public.trades
   SET preferred_risk_pct = risk_per_trade_at_open
 WHERE preferred_risk_pct IS NULL
   AND risk_per_trade_at_open IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mirror_trade_log_to_trades()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists uuid;
BEGIN
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
    screenshot_url, notes,
    actual_risk_pct, preferred_risk_pct
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
    NEW.note,
    NEW.risk_percent,
    NEW.preferred_risk_percent_at_open
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'mirror_trade_log_to_trades failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;