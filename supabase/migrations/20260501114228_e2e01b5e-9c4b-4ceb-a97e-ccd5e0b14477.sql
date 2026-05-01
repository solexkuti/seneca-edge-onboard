-- 1. Subscription tier on profiles
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier NOT NULL DEFAULT 'free';

-- 2. mt5_imports — log of each manual CSV upload
CREATE TABLE IF NOT EXISTS public.mt5_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  account_label TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_duplicate INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  latest_deal_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mt5_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mt5 imports"
  ON public.mt5_imports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own mt5 imports"
  ON public.mt5_imports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own mt5 imports"
  ON public.mt5_imports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mt5_imports_user_created
  ON public.mt5_imports (user_id, created_at DESC);

-- 3. broker_deal_id on trades (for dedup on re-import)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS broker_deal_id TEXT;

-- Partial unique index: a given (user, source, deal_id) tuple can only exist once
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trades_user_source_dealid
  ON public.trades (user_id, source, broker_deal_id)
  WHERE broker_deal_id IS NOT NULL;