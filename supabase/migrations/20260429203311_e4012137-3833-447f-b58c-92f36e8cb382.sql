-- Add data_quality marker to trade_logs so trades flagged by the price-correction
-- engine can be excluded from analytics or surfaced as low-confidence.
ALTER TABLE public.trade_logs
  ADD COLUMN IF NOT EXISTS data_quality text NOT NULL DEFAULT 'normal';

-- Constrain to known values; "low" is reserved for trades the user submitted
-- after rejecting a price-correction suggestion.
ALTER TABLE public.trade_logs
  DROP CONSTRAINT IF EXISTS trade_logs_data_quality_check;
ALTER TABLE public.trade_logs
  ADD CONSTRAINT trade_logs_data_quality_check
  CHECK (data_quality IN ('normal', 'low'));

CREATE INDEX IF NOT EXISTS idx_trade_logs_user_data_quality
  ON public.trade_logs (user_id, data_quality);