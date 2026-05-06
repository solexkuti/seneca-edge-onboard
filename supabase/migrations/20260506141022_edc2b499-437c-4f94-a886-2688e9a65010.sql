ALTER TABLE public.trade_logs
  ADD COLUMN IF NOT EXISTS account_balance_at_open numeric,
  ADD COLUMN IF NOT EXISTS preferred_risk_percent_at_open numeric;