
-- discipline_state: per-user snapshot of the last computed discipline score
CREATE TABLE IF NOT EXISTS public.discipline_state (
  user_id uuid PRIMARY KEY,
  score integer NOT NULL DEFAULT 50,
  state text NOT NULL DEFAULT 'at_risk',
  decision_score integer NOT NULL DEFAULT 50,
  execution_score integer NOT NULL DEFAULT 50,
  decision_sample integer NOT NULL DEFAULT 0,
  execution_sample integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discipline_state_score_range CHECK (score BETWEEN 0 AND 100),
  CONSTRAINT discipline_state_state_valid CHECK (state IN ('in_control','slipping','at_risk','locked'))
);

ALTER TABLE public.discipline_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own discipline state"
  ON public.discipline_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own discipline state"
  ON public.discipline_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own discipline state"
  ON public.discipline_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER discipline_state_set_updated_at
  BEFORE UPDATE ON public.discipline_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- session_state: per-user snapshot of today's session flags
CREATE TABLE IF NOT EXISTS public.session_state (
  user_id uuid PRIMARY KEY,
  checklist_confirmed boolean NOT NULL DEFAULT false,
  trading_allowed boolean NOT NULL DEFAULT false,
  block_reason text,
  generated_for date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own session state"
  ON public.session_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own session state"
  ON public.session_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own session state"
  ON public.session_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER session_state_set_updated_at
  BEFORE UPDATE ON public.session_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
