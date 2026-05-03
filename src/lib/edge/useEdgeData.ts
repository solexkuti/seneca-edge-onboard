// useEdgeData — backwards-compatible shim over the BehaviorState SSOT.
//
// Historically each feature had its own copy of the load+compute logic.
// Now all derivation lives in <BehaviorStateProvider /> and this hook just
// projects the same shape the old call sites expect.
//
// One brain. One state. Everywhere.

import { useCallback } from "react";
import { useBehaviorState } from "./BehaviorStateProvider";
import type { EdgeReport, RuleViolationRow, TradeRow } from "./types";

type State =
  | { status: "loading"; report: null; error: null }
  | { status: "ready"; report: EdgeReport; error: null }
  | { status: "error"; report: null; error: string };

export function useEdgeData(): State & {
  trades: TradeRow[];
  violations: RuleViolationRow[];
  refresh: () => void;
} {
  const { status, error, state, refresh } = useBehaviorState();

  const sync = useCallback(() => {
    void refresh();
  }, [refresh]);

  if (status === "loading") {
    return {
      status: "loading",
      report: null,
      error: null,
      trades: state.trades,
      violations: state.violations,
      refresh: sync,
    };
  }
  if (status === "error") {
    return {
      status: "error",
      report: null,
      error: error ?? "Unknown error",
      trades: state.trades,
      violations: state.violations,
      refresh: sync,
    };
  }
  return {
    status: "ready",
    report: state.report,
    error: null,
    trades: state.trades,
    violations: state.violations,
    refresh: sync,
  };
}
