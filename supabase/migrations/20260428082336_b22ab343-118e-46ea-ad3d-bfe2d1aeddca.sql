
-- 1) Mistake tag enum + column on discipline_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mistake_tag') THEN
    CREATE TYPE public.mistake_tag AS ENUM (
      'fomo',
      'revenge',
      'overleveraged',
      'early_exit',
      'late_entry',
      'no_setup',
      'emotional'
    );
  END IF;
END$$;

ALTER TABLE public.discipline_logs
  ADD COLUMN IF NOT EXISTS mistake_tag public.mistake_tag;

-- 2) Enrich behavior_patterns table for richer tracking
ALTER TABLE public.behavior_patterns
  ADD COLUMN IF NOT EXISTS pattern_type text,
  ADD COLUMN IF NOT EXISTS trigger_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_triggered_at timestamptz NOT NULL DEFAULT now();

-- Backfill pattern_type from kind for existing rows
UPDATE public.behavior_patterns SET pattern_type = kind::text WHERE pattern_type IS NULL;

-- Allow update so the trigger can bump count + timestamp
DROP POLICY IF EXISTS "Users can update own behavior patterns" ON public.behavior_patterns;
CREATE POLICY "Users can update own behavior patterns"
  ON public.behavior_patterns
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Pattern detection function — analyzes user's last 10 trades + logs
CREATE OR REPLACE FUNCTION public.detect_behavior_patterns(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent record;
  v_trade_ids uuid[];
  v_break_count int;
  v_loss_after_break int;
  v_top_break text;
  v_top_break_count int;
BEGIN
  -- Pull the last 10 trades (with their discipline log) newest-first into a temp table
  CREATE TEMP TABLE IF NOT EXISTS _recent ON COMMIT DROP AS
  SELECT t.id AS trade_id,
         t.executed_at,
         t.result,
         t.rr,
         dl.followed_entry,
         dl.followed_exit,
         dl.followed_risk,
         dl.followed_behavior,
         (dl.followed_entry AND dl.followed_exit AND dl.followed_risk AND dl.followed_behavior) AS followed_plan,
         dl.discipline_score,
         dl.mistake_tag
    FROM public.trades t
    JOIN public.discipline_logs dl ON dl.trade_id = t.id
   WHERE t.user_id = p_user_id
   ORDER BY t.executed_at DESC
   LIMIT 10;

  -- A) 2+ undisciplined trades in a row (look at top 3)
  SELECT array_agg(trade_id ORDER BY executed_at DESC),
         count(*) FILTER (WHERE NOT followed_plan)
    INTO v_trade_ids, v_break_count
    FROM (SELECT * FROM _recent LIMIT 3) s;

  IF v_break_count >= 2 THEN
    -- Check the top two are both undisciplined
    PERFORM 1 FROM (
      SELECT followed_plan FROM _recent LIMIT 2
    ) x WHERE NOT x.followed_plan;
    IF (SELECT count(*) FROM (SELECT followed_plan FROM _recent LIMIT 2) y WHERE NOT y.followed_plan) >= 2 THEN
      INSERT INTO public.behavior_patterns
        (user_id, kind, pattern_type, message, severity, trade_ids, meta, trigger_count, last_triggered_at)
      VALUES (
        p_user_id,
        'undisciplined_streak',
        'undisciplined_streak',
        CASE WHEN v_break_count >= 3
             THEN 'Three undisciplined trades in a row — system is breaking down.'
             ELSE 'Two undisciplined trades in a row — slow down before the next entry.' END,
        CASE WHEN v_break_count >= 3 THEN 3 ELSE 2 END,
        (SELECT array_agg(trade_id ORDER BY executed_at DESC) FROM (SELECT * FROM _recent LIMIT v_break_count) z),
        jsonb_build_object('count', v_break_count),
        1, now()
      );
    END IF;
  END IF;

  -- B) Most repeated rule break across last 5 — if same rule broken 3+ times
  WITH last5 AS (SELECT * FROM _recent LIMIT 5),
       breaks AS (
         SELECT 'entry' AS rule, count(*) AS c FROM last5 WHERE NOT followed_entry
         UNION ALL SELECT 'exit', count(*) FROM last5 WHERE NOT followed_exit
         UNION ALL SELECT 'risk', count(*) FROM last5 WHERE NOT followed_risk
         UNION ALL SELECT 'behavior', count(*) FROM last5 WHERE NOT followed_behavior
       )
  SELECT rule, c INTO v_top_break, v_top_break_count
    FROM breaks WHERE c >= 3 ORDER BY c DESC LIMIT 1;

  IF v_top_break IS NOT NULL THEN
    INSERT INTO public.behavior_patterns
      (user_id, kind, pattern_type, message, severity, trade_ids, meta, trigger_count, last_triggered_at)
    VALUES (
      p_user_id,
      'rule_breaking',
      'rule_breaking_' || v_top_break,
      'Same rule (' || v_top_break || ') broken ' || v_top_break_count || ' of last 5 trades.',
      2,
      (SELECT array_agg(trade_id) FROM _recent LIMIT 5),
      jsonb_build_object('rule', v_top_break, 'count', v_top_break_count),
      1, now()
    );
  END IF;

  -- C) Consecutive losses after rule break (rule-break trade followed by 2 losses)
  WITH chrono AS (
    SELECT *, row_number() OVER (ORDER BY executed_at) AS rn FROM (SELECT * FROM _recent LIMIT 5) s
  ),
  triggers AS (
    SELECT a.trade_id AS t1, b.trade_id AS t2, c.trade_id AS t3
      FROM chrono a JOIN chrono b ON b.rn = a.rn + 1 JOIN chrono c ON c.rn = a.rn + 2
     WHERE NOT a.followed_plan AND b.result = 'loss' AND c.result = 'loss'
     LIMIT 1
  )
  INSERT INTO public.behavior_patterns
    (user_id, kind, pattern_type, message, severity, trade_ids, meta, trigger_count, last_triggered_at)
  SELECT p_user_id,
         'consecutive_losses_after_break',
         'consecutive_losses_after_break',
         'Two losses followed a rule break — the slip cascaded. Stop and reset.',
         3,
         ARRAY[t1, t2, t3],
         '{}'::jsonb,
         1, now()
    FROM triggers;

  DROP TABLE IF EXISTS _recent;
EXCEPTION WHEN OTHERS THEN
  -- Never block the originating insert if pattern detection fails
  BEGIN DROP TABLE IF EXISTS _recent; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE WARNING 'detect_behavior_patterns failed: %', SQLERRM;
END;
$$;

-- 4) Trigger on discipline_logs (fires AFTER both trade + log exist)
CREATE OR REPLACE FUNCTION public.trg_detect_patterns_after_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.detect_behavior_patterns(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS detect_patterns_after_discipline_log ON public.discipline_logs;
CREATE TRIGGER detect_patterns_after_discipline_log
  AFTER INSERT ON public.discipline_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_detect_patterns_after_log();
