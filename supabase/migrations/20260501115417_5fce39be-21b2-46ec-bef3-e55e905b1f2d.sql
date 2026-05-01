-- Deriv connections: one per user (single account for now, account_id stored)
CREATE TABLE public.deriv_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  api_token TEXT NOT NULL,
  account_id TEXT,
  account_label TEXT,
  currency TEXT,
  balance NUMERIC,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  auto_sync BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  last_deal_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deriv_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deriv connection"
  ON public.deriv_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own deriv connection"
  ON public.deriv_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own deriv connection"
  ON public.deriv_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own deriv connection"
  ON public.deriv_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_deriv_connections_updated
  BEFORE UPDATE ON public.deriv_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_deriv_connections_auto_sync ON public.deriv_connections (auto_sync) WHERE auto_sync = true;

-- Deriv import runs (one row per sync attempt)
CREATE TABLE public.deriv_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual',
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_duplicate INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  latest_deal_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deriv_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deriv imports"
  ON public.deriv_imports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own deriv imports"
  ON public.deriv_imports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_deriv_imports_user_created ON public.deriv_imports (user_id, created_at DESC);

-- Realtime so the UI updates as new trades stream in
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deriv_connections;