
CREATE TABLE public.recovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  triggered_by_trade_id UUID,
  triggered_by_event_id UUID,
  trigger_reason TEXT NOT NULL DEFAULT 'discipline_locked',

  step TEXT NOT NULL DEFAULT 'reflection',
  reflection_completed BOOLEAN NOT NULL DEFAULT false,
  recommit_completed BOOLEAN NOT NULL DEFAULT false,
  cooldown_completed BOOLEAN NOT NULL DEFAULT false,

  cooldown_seconds INTEGER NOT NULL DEFAULT 900,
  cooldown_started_at TIMESTAMPTZ,
  cooldown_ends_at TIMESTAMPTZ,

  reflection_violation_match TEXT,
  reflection_why TEXT,
  reflection_next_action TEXT,
  recommit_acks JSONB NOT NULL DEFAULT '{}'::jsonb,

  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_time TIMESTAMPTZ,
  success BOOLEAN,

  probation_state TEXT NOT NULL DEFAULT 'pending',
  probation_decisions_seen INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recovery sessions"
ON public.recovery_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recovery sessions"
ON public.recovery_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own recovery sessions"
ON public.recovery_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own recovery sessions"
ON public.recovery_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_recovery_sessions_user_active
  ON public.recovery_sessions (user_id, completed_time NULLS FIRST, created_at DESC);

CREATE TRIGGER trg_recovery_sessions_updated_at
BEFORE UPDATE ON public.recovery_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
