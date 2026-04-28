-- Behavior patterns: persisted detections of repeated/concerning behavior
CREATE TYPE public.behavior_pattern_kind AS ENUM (
  'emotional_repetition',
  'consecutive_losses_after_break',
  'undisciplined_streak',
  'rule_breaking',
  'revenge',
  'overtrading'
);

CREATE TABLE public.behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind public.behavior_pattern_kind NOT NULL,
  message TEXT NOT NULL,
  severity SMALLINT NOT NULL DEFAULT 1,
  trade_ids UUID[] NOT NULL DEFAULT '{}',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX behavior_patterns_user_detected_idx
  ON public.behavior_patterns (user_id, detected_at DESC);

ALTER TABLE public.behavior_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own behavior patterns"
  ON public.behavior_patterns FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own behavior patterns"
  ON public.behavior_patterns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own behavior patterns"
  ON public.behavior_patterns FOR DELETE TO authenticated
  USING (auth.uid() = user_id);