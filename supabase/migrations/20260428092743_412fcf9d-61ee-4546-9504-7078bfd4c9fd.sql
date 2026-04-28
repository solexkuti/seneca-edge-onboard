-- ============================================================================
-- daily_streaks: one row per user, kept up to date by a trigger on discipline_logs
-- ============================================================================
CREATE TABLE public.daily_streaks (
  user_id          uuid PRIMARY KEY,
  current_streak   integer NOT NULL DEFAULT 0,
  longest_streak   integer NOT NULL DEFAULT 0,
  last_clean_date  date,
  last_break_date  date,
  identity_label   text NOT NULL DEFAULT 'starting fresh',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own streak"
  ON public.daily_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own streak"
  ON public.daily_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own streak"
  ON public.daily_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- checklist_confirmations: proof the user confirmed today's checklist before trading
-- ============================================================================
CREATE TABLE public.checklist_confirmations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL,
  generated_for          date NOT NULL,
  confirmed_at           timestamptz NOT NULL DEFAULT now(),
  control_state          text NOT NULL,
  discipline_score       integer NOT NULL DEFAULT 0,
  allowed_tiers          jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_restrictions   jsonb NOT NULL DEFAULT '[]'::jsonb,
  focus                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  rule_acknowledgements  jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{id, label, category, confirmed:true}]
  strategy_name          text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_confirmations_user_date
  ON public.checklist_confirmations (user_id, generated_for DESC);

ALTER TABLE public.checklist_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own confirmations"
  ON public.checklist_confirmations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own confirmations"
  ON public.checklist_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own confirmations"
  ON public.checklist_confirmations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own confirmations"
  ON public.checklist_confirmations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Identity label helper — pure SQL, deterministic
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_identity_label(streak integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN streak <= 0  THEN 'starting fresh'
    WHEN streak < 3   THEN streak || ' clean trade' || CASE WHEN streak = 1 THEN '' ELSE 's' END
    WHEN streak < 7   THEN streak || ' days disciplined'
    WHEN streak < 14  THEN streak || ' days controlled'
    WHEN streak < 30  THEN streak || ' days elite execution'
    ELSE streak || ' days locked in'
  END;
$$;

-- ============================================================================
-- Streak trigger: fires after every discipline_logs insert.
-- Clean trade (all 4 followed) → +1 streak.
-- Broken trade → reset streak to 0 and stamp last_break_date.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_daily_streak_after_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean boolean;
  v_today date := CURRENT_DATE;
  v_existing public.daily_streaks%ROWTYPE;
  v_new_streak integer;
BEGIN
  v_clean := NEW.followed_entry AND NEW.followed_exit
         AND NEW.followed_risk AND NEW.followed_behavior;

  SELECT * INTO v_existing FROM public.daily_streaks WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    INSERT INTO public.daily_streaks (user_id, current_streak, longest_streak,
                                      last_clean_date, last_break_date, identity_label, updated_at)
    VALUES (
      NEW.user_id,
      CASE WHEN v_clean THEN 1 ELSE 0 END,
      CASE WHEN v_clean THEN 1 ELSE 0 END,
      CASE WHEN v_clean THEN v_today ELSE NULL END,
      CASE WHEN v_clean THEN NULL ELSE v_today END,
      public.compute_identity_label(CASE WHEN v_clean THEN 1 ELSE 0 END),
      now()
    );
    RETURN NEW;
  END IF;

  IF v_clean THEN
    v_new_streak := COALESCE(v_existing.current_streak, 0) + 1;
    UPDATE public.daily_streaks
       SET current_streak = v_new_streak,
           longest_streak = GREATEST(COALESCE(v_existing.longest_streak, 0), v_new_streak),
           last_clean_date = v_today,
           identity_label  = public.compute_identity_label(v_new_streak),
           updated_at      = now()
     WHERE user_id = NEW.user_id;
  ELSE
    UPDATE public.daily_streaks
       SET current_streak = 0,
           last_break_date = v_today,
           identity_label  = public.compute_identity_label(0),
           updated_at      = now()
     WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'update_daily_streak_after_log failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_daily_streak ON public.discipline_logs;
CREATE TRIGGER trg_update_daily_streak
AFTER INSERT ON public.discipline_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_daily_streak_after_log();

-- ============================================================================
-- updated_at maintenance for daily_streaks
-- ============================================================================
DROP TRIGGER IF EXISTS trg_daily_streaks_updated_at ON public.daily_streaks;
CREATE TRIGGER trg_daily_streaks_updated_at
BEFORE UPDATE ON public.daily_streaks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
