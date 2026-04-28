-- Trade lock enforcement at the database level.
-- Source of truth = checklist_confirmations + recent discipline_logs.

CREATE OR REPLACE FUNCTION public.is_trade_unlocked(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_at timestamptz;
  v_recent_breaks int;
BEGIN
  -- Most recent confirmation for today
  SELECT confirmed_at INTO v_confirmed_at
    FROM public.checklist_confirmations
   WHERE user_id = p_user_id
     AND generated_for = CURRENT_DATE
   ORDER BY confirmed_at DESC
   LIMIT 1;

  IF v_confirmed_at IS NULL THEN
    RETURN FALSE; -- never confirmed today
  END IF;

  -- Re-lock if the last 2 discipline logs created AFTER the confirmation
  -- are both undisciplined.
  SELECT count(*) INTO v_recent_breaks
    FROM (
      SELECT (followed_entry AND followed_exit AND followed_risk AND followed_behavior) AS clean
        FROM public.discipline_logs
       WHERE user_id = p_user_id
         AND created_at >= v_confirmed_at
       ORDER BY created_at DESC
       LIMIT 2
    ) s
   WHERE NOT s.clean;

  IF v_recent_breaks >= 2 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Trigger: block inserts when locked.
CREATE OR REPLACE FUNCTION public.enforce_trade_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_trade_unlocked(NEW.user_id) THEN
    RAISE EXCEPTION 'TRADING_LOCKED: Checklist confirmation required before trading.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trade_lock ON public.trades;
CREATE TRIGGER trg_enforce_trade_lock
  BEFORE INSERT ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trade_lock();