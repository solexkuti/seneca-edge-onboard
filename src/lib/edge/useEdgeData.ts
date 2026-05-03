// React hook: loads the current user's trades + rule_violations and
// returns the computed EdgeReport. Realtime-aware — re-runs when either
// table changes for this user.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildEdgeReport } from "./engine";
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
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [violations, setViolations] = useState<RuleViolationRow[]>([]);
  const [status, setStatus] = useState<State["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        if (!cancelled) {
          setTrades([]);
          setViolations([]);
          setStatus("ready");
        }
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
        if (cancelled) return;
        if (te) throw te;
        if (ve) throw ve;
        setTrades((t ?? []) as unknown as TradeRow[]);
        setViolations((v ?? []) as unknown as RuleViolationRow[]);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Realtime: bump tick when trades or violations change for this user
  useEffect(() => {
    const channel = supabase
      .channel("edge-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trades" },
        () => setTick((n) => n + 1),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rule_violations" },
        () => setTick((n) => n + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const report = useMemo(
    () => (status === "ready" ? buildEdgeReport(trades, violations) : null),
    [status, trades, violations],
  );

  if (status === "loading") {
    return {
      status: "loading",
      report: null,
      error: null,
      trades,
      violations,
      refresh: () => setTick((n) => n + 1),
    };
  }
  if (status === "error") {
    return {
      status: "error",
      report: null,
      error: error ?? "Unknown error",
      trades,
      violations,
      refresh: () => setTick((n) => n + 1),
    };
  }
  return {
    status: "ready",
    report: report!,
    error: null,
    trades,
    violations,
    refresh: () => setTick((n) => n + 1),
  };
}
