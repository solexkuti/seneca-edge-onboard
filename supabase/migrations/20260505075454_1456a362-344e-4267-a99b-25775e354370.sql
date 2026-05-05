-- ============================================================================
-- Phase 1: Hard reset + SSOT foundation
-- ============================================================================
-- 1. Truncate all per-user trade / behavior / discipline data for ALL users.
--    Keep: auth.users, profiles (zeroed), strategies, strategy_blueprints,
--          deriv_connections (token only), email_* infra.
-- 2. Add balance + balance_source to profiles (manual | synced).
-- 3. Reset discipline defaults to start = 100 (cumulative +10/-10 model).
-- ============================================================================

-- 1. Hard reset of session data (global, all users)
TRUNCATE TABLE
  public.trades,
  public.trade_logs,
  public.discipline_logs,
  public.analyzer_events,
  public.behavior_patterns,
  public.journal_entries,
  public.rule_violations,
  public.replay_trades,
  public.replay_sessions,
  public.chart_analyses,
  public.trade_annotations,
  public.emotional_events,
  public.pressure_events,
  public.lock_attempt_events,
  public.discipline_state,
  public.session_state,
  public.daily_streaks,
  public.checklist_confirmations,
  public.recovery_sessions,
  public.deriv_imports,
  public.mt5_imports
RESTART IDENTITY CASCADE;

-- 2. Account balance: support manual + synced with conflict resolution
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_balance numeric,
  ADD COLUMN IF NOT EXISTS account_equity numeric,
  ADD COLUMN IF NOT EXISTS balance_source text NOT NULL DEFAULT 'manual'
    CHECK (balance_source IN ('manual', 'synced')),
  ADD COLUMN IF NOT EXISTS balance_updated_at timestamptz;

-- 3. Discipline defaults → start at 100, clamp 0..100
ALTER TABLE public.profiles
  ALTER COLUMN discipline_score SET DEFAULT 100;

UPDATE public.profiles SET discipline_score = 100;

ALTER TABLE public.discipline_state
  ALTER COLUMN score SET DEFAULT 100,
  ALTER COLUMN state SET DEFAULT 'in_control',
  ALTER COLUMN decision_score SET DEFAULT 100,
  ALTER COLUMN execution_score SET DEFAULT 100;
