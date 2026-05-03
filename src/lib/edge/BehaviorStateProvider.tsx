// BehaviorStateProvider — SINGLE SOURCE OF TRUTH for the entire hub.
//
// One brain. One state. Everywhere.
//
// Owns the user's BehaviorState:
//   - raw inputs:  trades, rule_violations
//   - derived:     EdgeReport (engine.ts) + DerivedMetrics (metricsEngine.ts)
//   - status:      execution_drift_status, recent_trade_summary
//
// Every feature (Dashboard, Mentor, Alerts, Analyzer, Insights) reads from
// this provider — never recompute logic locally.
//
// Lifecycle:
//   - Hydrates from Supabase on mount and whenever auth state changes.
//   - Subscribes to realtime changes on `trades` and `rule_violations` for the
//     current user. Any insert/update/delete triggers a recompute and
//     broadcasts to ALL active sessions automatically (Supabase Realtime).
//   - On SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED, hard-resets cached state
//     and rebuilds from the database. No stale data ever crosses sessions.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildEdgeReport } from "./engine";
import {
  buildDerivedMetrics,
  EMPTY_DERIVED,
  type DerivedMetrics,
} from "./metricsEngine";
import type { EdgeReport, RuleViolationRow, TradeRow } from "./types";

// ---------------- Types ----------------

export type ExecutionDriftStatus = "aligned" | "drifting" | "broken" | "idle";

export type RecentTradeSummary = {
  count_total: number;
  count_executed: number;
  count_missed: number;
  count_clean: number;
  count_rule_break: number;
  last_trade_id: string | null;
  last_trade_at: string | null;
};

export type BehaviorState = {
  // Identity
  user_id: string | null;
  computed_at: string;       // ISO timestamp of last recompute
  last_processed_trade_id: string | null;

  // Raw inputs
  trades: TradeRow[];
  violations: RuleViolationRow[];

  // Derived
  report: EdgeReport;            // from engine.ts (system vs actual, gap, etc.)
  derived: DerivedMetrics;       // from metricsEngine.ts (perf + behavior + trend)
  execution_drift_status: ExecutionDriftStatus;
  recent_trade_summary: RecentTradeSummary;
};

type Status = "loading" | "ready" | "error";

type ContextValue = {
  status: Status;
  error: string | null;
  state: BehaviorState;
  /** Force a fresh fetch from the database (hard reset). */
  refresh: () => Promise<void>;
};

// ---------------- Empty baseline ----------------

const EMPTY_REPORT: EdgeReport = {
  hasData: false,
  totalTrades: 0,
  systemEdge: { sample: 0, winRate: 0, avgR: 0, totalR: 0 },
  actualEdge: { sample: 0, winRate: 0, avgR: 0, totalR: 0 },
  missedR: 0,
  missedCount: 0,
  executionGapR: 0,
  disciplineScore: 100,
  ruleAdherencePct: 100,
  violations: [],
  sessions: [],
  patterns: [],
  lastTradeAt: null,
};

const EMPTY_SUMMARY: RecentTradeSummary = {
  count_total: 0,
  count_executed: 0,
  count_missed: 0,
  count_clean: 0,
  count_rule_break: 0,
  last_trade_id: null,
  last_trade_at: null,
};

const EMPTY_STATE: BehaviorState = {
  user_id: null,
  computed_at: new Date(0).toISOString(),
  last_processed_trade_id: null,
  trades: [],
  violations: [],
  report: EMPTY_REPORT,
  derived: EMPTY_DERIVED,
  execution_drift_status: "idle",
  recent_trade_summary: EMPTY_SUMMARY,
};

// ---------------- Pure builder ----------------

function deriveDriftStatus(
  report: EdgeReport,
  derived: DerivedMetrics,
): ExecutionDriftStatus {
  if (!report.hasData) return "idle";
  // Aligned: high discipline AND no meaningful execution gap.
  // Drifting: noticeable gap or moderate discipline drop.
  // Broken: severe discipline collapse OR large negative gap.
  const discipline = derived.behavior_metrics.discipline_score;
  const gap = report.executionGapR;
  if (discipline < 50 || gap >= 5) return "broken";
  if (discipline < 75 || gap >= 1.5) return "drifting";
  return "aligned";
}

function summarize(trades: TradeRow[]): RecentTradeSummary {
  if (trades.length === 0) return { ...EMPTY_SUMMARY };
  let executed = 0;
  let missed = 0;
  let clean = 0;
  let ruleBreak = 0;
  let lastId: string | null = null;
  let lastAt: string | null = null;
  for (const t of trades) {
    const isMissed = t.trade_type === "missed";
    if (isMissed) missed += 1;
    else {
      executed += 1;
      if ((t.rules_broken ?? []).length > 0) ruleBreak += 1;
      else clean += 1;
    }
    if (!lastAt || t.executed_at > lastAt) {
      lastAt = t.executed_at;
      lastId = t.id;
    }
  }
  return {
    count_total: trades.length,
    count_executed: executed,
    count_missed: missed,
    count_clean: clean,
    count_rule_break: ruleBreak,
    last_trade_id: lastId,
    last_trade_at: lastAt,
  };
}

function buildBehaviorState(
  userId: string | null,
  trades: TradeRow[],
  violations: RuleViolationRow[],
): BehaviorState {
  const report = buildEdgeReport(trades, violations);
  const derived = buildDerivedMetrics(trades, violations);
  const summary = summarize(trades);
  const drift = deriveDriftStatus(report, derived);
  return {
    user_id: userId,
    computed_at: new Date().toISOString(),
    last_processed_trade_id: summary.last_trade_id,
    trades,
    violations,
    report,
    derived,
    execution_drift_status: drift,
    recent_trade_summary: summary,
  };
}

// ---------------- Context ----------------

const BehaviorStateContext = createContext<ContextValue | null>(null);

export function BehaviorStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BehaviorState>(EMPTY_STATE);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const hardReset = useCallback(() => {
    setState(EMPTY_STATE);
    setError(null);
  }, []);

  const fetchAndCompute = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id ?? null;
    userIdRef.current = uid;

    if (!uid) {
      setState({ ...EMPTY_STATE, user_id: null, computed_at: new Date().toISOString() });
      setStatus("ready");
      return;
    }

    try {
      const [{ data: t, error: te }, { data: v, error: ve }] = await Promise.all([
        supabase
          .from("trades")
          .select(
            "id,user_id,asset,direction,entry_price,exit_price,stop_loss,take_profit,rr,risk_r,pnl,result,session,trade_type,missed_potential_r,rules_broken,rules_followed,screenshot_url,notes,executed_at,closed_at,created_at",
          )
          .eq("user_id", uid)
          .order("executed_at", { ascending: false })
          .limit(500),
        supabase
          .from("rule_violations")
          .select("*")
          .eq("user_id", uid)
          .order("occurred_at", { ascending: false })
          .limit(2000),
      ]);
      if (te) throw te;
      if (ve) throw ve;
      const trades = (t ?? []) as unknown as TradeRow[];
      const violations = (v ?? []) as unknown as RuleViolationRow[];
      const next = buildBehaviorState(uid, trades, violations);
      setState(next);
      setStatus("ready");
      setError(null);
      if (typeof window !== "undefined" && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[BehaviorState]", {
          user_id: next.user_id,
          computed_at: next.computed_at,
          last_processed_trade_id: next.last_processed_trade_id,
          discipline: next.derived.behavior_metrics.discipline_score,
          drift: next.execution_drift_status,
          trades: trades.length,
          violations: violations.length,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  // Subscribe to realtime + auth changes
  useEffect(() => {
    let cancelled = false;

    const subscribe = (uid: string | null) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (!uid) return;
      const ch = supabase
        .channel(`behavior-state:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${uid}` },
          () => {
            if (!cancelled) void fetchAndCompute();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rule_violations", filter: `user_id=eq.${uid}` },
          () => {
            if (!cancelled) void fetchAndCompute();
          },
        )
        .subscribe();
      channelRef.current = ch;
    };

    // Initial load
    (async () => {
      await fetchAndCompute();
      if (!cancelled) subscribe(userIdRef.current);
    })();

    // Auth change → hard reset + refetch + resubscribe under new uid
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        hardReset();
        setStatus("loading");
        void fetchAndCompute().then(() => subscribe(userIdRef.current));
      }
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchAndCompute, hardReset]);

  const value = useMemo<ContextValue>(
    () => ({
      status,
      error,
      state,
      refresh: fetchAndCompute,
    }),
    [status, error, state, fetchAndCompute],
  );

  return (
    <BehaviorStateContext.Provider value={value}>
      {children}
    </BehaviorStateContext.Provider>
  );
}

/** Read the unified BehaviorState. Returns the EMPTY_STATE baseline if used
 * outside the provider, so consumers never crash — but in practice mount the
 * provider at the hub root so all features share one truth. */
export function useBehaviorState(): ContextValue {
  const ctx = useContext(BehaviorStateContext);
  if (!ctx) {
    return {
      status: "ready",
      error: null,
      state: EMPTY_STATE,
      refresh: async () => {},
    };
  }
  return ctx;
}
