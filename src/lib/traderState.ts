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

export const EMPTY_DISCIPLINE: DisciplineSummary = {
  score: 50,
  state: "at_risk",
  consecutive_breaks: 0,
  recent: [],
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
 * Compute discipline from a rolling window of recent decisions.
 * Both analyzer events and execution logs contribute via score_delta.
 */
export function computeDiscipline(recent: RecentDecision[]): DisciplineSummary {
  const window = recent.slice(0, 20);
  // Start at neutral 50, apply deltas (already signed).
  let score = 50;
  for (const d of window) score += d.score_delta;
  score = Math.max(0, Math.min(100, score));

  // Consecutive breaks (most-recent-first).
  let streak = 0;
  for (const d of window) {
    if (d.verdict === "invalid") streak += 1;
    else break;
  }

  let state: DisciplineState = "optimal";
  if (score < 50) state = "locked";
  else if (score < 80) state = "at_risk";

  return { score, state, consecutive_breaks: streak, recent: window };
}

export async function loadTraderState(): Promise<TraderState> {
  const [strategy, lock, recent, activeRecovery, probation] = await Promise.all([
    loadActiveStrategyContext().catch(() => null),
    fetchTradeLockState().catch(() => null),
    fetchRecentDecisions(20).catch(() => [] as RecentDecision[]),
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

  const discipline = computeDiscipline(recent);
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
  const sub = supabase.auth.onAuthStateChange(() => cb());
  return () => sub.data.subscription.unsubscribe();
}
