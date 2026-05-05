// TRADER_STATE — single source of truth for the SenecaEdge decision system.
//
// Every module (Strategy Builder, Chart Analyzer, Daily Checklist, AI Mentor,
// Discipline Engine) reads from this state and writes back into it. Modules
// must NOT compute lock state, discipline state, or session permissions
// independently.
//
// Composition:
//   strategy   ← active locked blueprint (or null)
//   discipline ← computed from recent_decisions (analyzer + execution)
//   session    ← today's checklist confirmation + trade lock
//   trades     ← last N executed trades (kept lightweight)

import { supabase } from "@/integrations/supabase/client";
import {
  loadActiveStrategyContext,
  type ActiveStrategyContext,
} from "@/lib/activeStrategy";
import {
  fetchTradeLockState,
  type TradeLockState,
  TRADE_LOCK_EVENT,
} from "@/lib/tradeLock";
import {
  fetchRecentDecisions,
  ANALYZER_EVENT_LOGGED,
  type RecentDecision,
} from "@/lib/analyzerEvents";
import {
  loadDisciplineBreakdown,
  type DisciplineBreakdown,
  type DisciplineState as RawDisciplineState,
} from "@/lib/disciplineScore";
import {
  getActiveRecoverySession,
  evaluateProbation,
  RECOVERY_EVENT,
  type RecoverySession,
  type ProbationStatus,
} from "@/lib/recovery";

export type DisciplineState = RawDisciplineState; // in_control | slipping | at_risk | locked

export type DisciplineSummary = {
  score: number;            // 0–100, final
  state: DisciplineState;
  consecutive_breaks: number;
  recent: RecentDecision[];
  /** Full transparent breakdown — drives the score breakdown UI. */
  breakdown: DisciplineBreakdown;
};

export type SessionSummary = {
  checklist_confirmed: boolean;
  trade_lock: TradeLockState | null;
  trading_allowed: boolean;
};

export type TraderState = {
  loading: boolean;
  strategy: ActiveStrategyContext | null;
  discipline: DisciplineSummary;
  session: SessionSummary;
  recovery: {
    active_session: RecoverySession | null;
    probation: ProbationStatus;
  };
  /** Hard-block flags. If any is true, the matching surface MUST refuse to operate. */
  blocks: {
    no_strategy: boolean;
    not_confirmed: boolean;
    discipline_locked: boolean;
    /** True whenever the user must complete recovery before doing anything else. */
    in_recovery: boolean;
  };
};

const EMPTY_BREAKDOWN: DisciplineBreakdown = {
  score: 100,
  state: "in_control",
  decision_score: 100,
  decision_sample: 0,
  decision_contributions: [],
  execution_score: 100,
  execution_sample: 0,
  execution_contributions: [],
  penalties: [],
  execution_neutral: true,
  decision_neutral: true,
  total_trades: 0,
  clean_trades: 0,
  violation_count: 0,
  rule_adherence: 1,
  recent_contributions: [],
};

export const EMPTY_DISCIPLINE: DisciplineSummary = {
  score: 100,
  state: "in_control",
  consecutive_breaks: 0,
  recent: [],
  breakdown: EMPTY_BREAKDOWN,
};

export const EMPTY_STATE: TraderState = {
  loading: true,
  strategy: null,
  discipline: EMPTY_DISCIPLINE,
  session: {
    checklist_confirmed: false,
    trade_lock: null,
    trading_allowed: false,
  },
  recovery: {
    active_session: null,
    probation: {
      active: false,
      passed: false,
      failed: false,
      decisions_required: 2,
      decisions_seen: 0,
      last_session_id: null,
    },
  },
  blocks: {
    no_strategy: true,
    not_confirmed: true,
    discipline_locked: false,
    in_recovery: false,
  },
};

/**
 * Adapt the deterministic breakdown into the legacy DisciplineSummary shape
 * that the rest of the app already consumes. The breakdown is the source of
 * truth — `score`, `state`, and `consecutive_breaks` are derived from it.
 */
function summarize(
  breakdown: DisciplineBreakdown,
  recent: RecentDecision[],
): DisciplineSummary {
  const window = recent.slice(0, 20);
  let streak = 0;
  for (const d of window) {
    if (d.verdict === "invalid") streak += 1;
    else break;
  }
  return {
    score: breakdown.score,
    state: breakdown.state,
    consecutive_breaks: streak,
    recent: window,
    breakdown,
  };
}

/**
 * @deprecated Use `loadDisciplineBreakdown()` from `@/lib/disciplineScore`.
 * Kept as a back-compat shim that wraps the new deterministic scorer.
 */
export function computeDiscipline(recent: RecentDecision[]): DisciplineSummary {
  // The new scorer needs raw rows; if a caller only has `recent_decisions`,
  // fall back to a neutral breakdown — they should migrate to the new API.
  return summarize(EMPTY_BREAKDOWN, recent);
}

export async function loadTraderState(): Promise<TraderState> {
  const [strategy, lock, recent, breakdown, activeRecovery, probation] =
    await Promise.all([
      loadActiveStrategyContext().catch(() => null),
      fetchTradeLockState().catch(() => null),
      fetchRecentDecisions(20).catch(() => [] as RecentDecision[]),
      loadDisciplineBreakdown().catch(() => EMPTY_BREAKDOWN),
      getActiveRecoverySession().catch(() => null),
      evaluateProbation().catch(() => ({
        active: false,
        passed: false,
        failed: false,
        decisions_required: 2,
        decisions_seen: 0,
        last_session_id: null,
      })),
    ]);

  const discipline = summarize(breakdown, recent);
  const checklist_confirmed = !!lock && !lock.trade_lock;
  const has_strategy = !!strategy?.blueprint;
  const discipline_locked = discipline.state === "locked";
  const in_recovery = !!activeRecovery || discipline_locked;

  const trading_allowed =
    has_strategy && checklist_confirmed && !discipline_locked && !in_recovery;

  return {
    loading: false,
    strategy: strategy ?? null,
    discipline,
    session: {
      checklist_confirmed,
      trade_lock: lock,
      trading_allowed,
    },
    recovery: {
      active_session: activeRecovery,
      probation,
    },
    blocks: {
      no_strategy: !has_strategy,
      not_confirmed: !checklist_confirmed,
      discipline_locked,
      in_recovery,
    },
  };
}

/** Subscribe to events that should invalidate trader state. */
export function onTraderStateChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(TRADE_LOCK_EVENT, handler);
  window.addEventListener(ANALYZER_EVENT_LOGGED, handler);
  window.addEventListener(RECOVERY_EVENT, handler);
  return () => {
    window.removeEventListener(TRADE_LOCK_EVENT, handler);
    window.removeEventListener(ANALYZER_EVENT_LOGGED, handler);
    window.removeEventListener(RECOVERY_EVENT, handler);
  };
}

/** Auth listener — drops/recomputes state when the user changes. */
export function onAuthChange(cb: () => void): () => void {
  // Only react to true identity changes. TOKEN_REFRESHED / USER_UPDATED /
  // INITIAL_SESSION fire often (tab focus, background refresh) and must
  // NOT trigger global trader-state re-fetches mid-interaction.
  const sub = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") cb();
  });
  return () => sub.data.subscription.unsubscribe();
}
