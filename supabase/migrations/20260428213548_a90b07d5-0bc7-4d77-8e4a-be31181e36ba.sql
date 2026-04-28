CREATE TABLE IF NOT EXISTS public.lock_attempt_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surface text NOT NULL DEFAULT 'analyzer',
  discipline_state text NOT NULL,
  discipline_score integer NOT NULL DEFAULT 0,
  checklist_confirmed boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lock_attempts_user_time
  ON public.lock_attempt_events (user_id, created_at DESC);

ALTER TABLE public.lock_attempt_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own lock attempts"
  ON public.lock_attempt_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own lock attempts"
  ON public.lock_attempt_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own lock attempts"
  ON public.lock_attempt_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);