-- FX + multi-currency analytics architecture
-- Adds canonical base currency / live-rate snapshot fields to trades,
-- display preferences to profiles, and a centralized fx_rates cache.

-- 1. trades: persist base currency, risk basis at open, monetary pnl in base,
--    exchange rate captured at close, and converted snapshot to display currency.
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS base_currency text,
  ADD COLUMN IF NOT EXISTS risk_per_trade_at_open numeric,
  ADD COLUMN IF NOT EXISTS monetary_pnl_base numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate_at_close numeric,
  ADD COLUMN IF NOT EXISTS display_currency_at_close text,
  ADD COLUMN IF NOT EXISTS monetary_pnl_converted_snapshot numeric;

-- 2. profiles: add global display currency + metric display mode.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS metric_display_mode text NOT NULL DEFAULT 'rr_plus_currency';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_metric_display_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_metric_display_mode_check
  CHECK (metric_display_mode IN ('rr_only', 'rr_plus_currency', 'currency_only'));

-- 3. fx_rates: shared cache. Key by base+quote+date(YYYY-MM-DD). Trade snapshots
--    pin to the row valid on close date. Live UI reads "today" row.
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base text NOT NULL,
  quote text NOT NULL,
  rate numeric NOT NULL,
  rate_date date NOT NULL,
  source text NOT NULL DEFAULT 'frankfurter',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base, quote, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup
  ON public.fx_rates (base, quote, rate_date DESC);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FX rates readable by authenticated" ON public.fx_rates;
CREATE POLICY "FX rates readable by authenticated"
  ON public.fx_rates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "FX rates writable by authenticated" ON public.fx_rates;
CREATE POLICY "FX rates writable by authenticated"
  ON public.fx_rates FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "FX rates updatable by authenticated" ON public.fx_rates;
CREATE POLICY "FX rates updatable by authenticated"
  ON public.fx_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
