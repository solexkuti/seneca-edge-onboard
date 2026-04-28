CREATE TABLE public.pressure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surface text NOT NULL DEFAULT 'journal_log',
  trigger_reason text NOT NULL,
  triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  proceeded boolean NOT NULL DEFAULT false,
  hold_seconds integer NOT NULL DEFAULT 3,
  escalation_level integer NOT NULL DEFAULT 0,
  last_event_klass text,
  discipline_state text NOT NULL,
  discipline_score integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pressure_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pressure events"
  ON public.pressure_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pressure events"
  ON public.pressure_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own pressure events"
  ON public.pressure_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_pressure_events_user_created
  ON public.pressure_events (user_id, created_at DESC);
