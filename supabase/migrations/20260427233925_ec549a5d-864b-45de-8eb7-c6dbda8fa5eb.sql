ALTER TABLE public.discipline_logs
  ALTER COLUMN trade_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discipline_logs_user_created
  ON public.discipline_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_user_executed
  ON public.trades (user_id, executed_at DESC);