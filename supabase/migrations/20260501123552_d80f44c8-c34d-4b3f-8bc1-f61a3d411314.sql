-- 1. Cached historical candles (shared cache, not user-specific)
CREATE TABLE public.candles (
  provider text NOT NULL,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  "time" bigint NOT NULL, -- unix seconds, candle open time
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, symbol, timeframe, "time")
);

CREATE INDEX idx_candles_lookup ON public.candles (provider, symbol, timeframe, "time" DESC);

ALTER TABLE public.candles ENABLE ROW LEVEL SECURITY;

-- Read-only public access (no PII; price data)
CREATE POLICY "Candles readable by authenticated"
  ON public.candles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Replay sessions
CREATE TABLE public.replay_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  symbol text NOT NULL,
  symbol_label text,
  category text NOT NULL DEFAULT 'synthetic',
  timeframe text NOT NULL DEFAULT '1m',
  range_from bigint NOT NULL,
  range_to bigint NOT NULL,
  cursor_time bigint NOT NULL,
  speed numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'paused',
  starting_equity numeric NOT NULL DEFAULT 10000,
  equity numeric NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.replay_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own replay sessions"
  ON public.replay_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own replay sessions"
  ON public.replay_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own replay sessions"
  ON public.replay_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own replay sessions"
  ON public.replay_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER replay_sessions_set_updated_at
  BEFORE UPDATE ON public.replay_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Simulated trades inside a replay session
CREATE TABLE public.replay_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.replay_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price numeric NOT NULL,
  stop_loss numeric,
  take_profit numeric,
  risk_pct numeric,
  lot_size numeric,
  opened_at bigint NOT NULL, -- unix seconds (replay time)
  closed_at bigint,
  exit_price numeric,
  result text CHECK (result IN ('win','loss','breakeven','open')) DEFAULT 'open',
  rr numeric,
  pnl numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_replay_trades_session ON public.replay_trades(session_id, opened_at);

ALTER TABLE public.replay_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own replay trades"
  ON public.replay_trades FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own replay trades"
  ON public.replay_trades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own replay trades"
  ON public.replay_trades FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own replay trades"
  ON public.replay_trades FOR DELETE TO authenticated
  USING (auth.uid() = user_id);