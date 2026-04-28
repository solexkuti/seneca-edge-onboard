-- Analyzer Events: pre-trade decision quality, independent of executed trades.
-- This complements discipline_logs (which is execution quality, tied to trades).
-- Together they feed the discipline engine via the recent_decisions view.

CREATE TABLE IF NOT EXISTS public.analyzer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  analysis_id uuid,
  blueprint_id uuid,
  verdict text NOT NULL CHECK (verdict IN ('valid', 'weak', 'invalid')),
  violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_delta integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyzer_events_user_time
  ON public.analyzer_events (user_id, created_at DESC);

ALTER TABLE public.analyzer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own analyzer events"
  ON public.analyzer_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own analyzer events"
  ON public.analyzer_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own analyzer events"
  ON public.analyzer_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Unified recent decisions view (pre-trade + executed).
-- Used by discipline engine, mentor, and checklist adjustments.
CREATE OR REPLACE VIEW public.recent_decisions
WITH (security_invoker = true) AS
SELECT
  'analyzer'::text AS source,
  ae.id,
  ae.user_id,
  ae.verdict,
  ae.score_delta,
  ae.violations,
  NULL::uuid AS trade_id,
  ae.analysis_id,
  ae.created_at
FROM public.analyzer_events ae
UNION ALL
SELECT
  'execution'::text AS source,
  dl.id,
  dl.user_id,
  CASE
    WHEN dl.followed_entry AND dl.followed_exit AND dl.followed_risk AND dl.followed_behavior
      THEN 'valid'
    ELSE 'invalid'
  END AS verdict,
  (dl.discipline_score - 50) AS score_delta,
  jsonb_build_object(
    'entry', NOT dl.followed_entry,
    'exit', NOT dl.followed_exit,
    'risk', NOT dl.followed_risk,
    'behavior', NOT dl.followed_behavior,
    'mistake_tag', dl.mistake_tag
  ) AS violations,
  dl.trade_id,
  NULL::uuid AS analysis_id,
  dl.created_at
FROM public.discipline_logs dl;