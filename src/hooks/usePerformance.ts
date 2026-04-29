// usePerformance — real-data trade performance snapshot for the dashboard
// and the mentor. Reads `trade_logs` (last N) and exposes computed metrics
// + the mentor payload. No placeholders: when there are no trades, all
// metric fields are null/zero and `hasTrades` is false so consumers can
// render empty state copy.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildMentorPayload,
  computeMetrics,
  fetchTradeLogs,
  type MentorPerformancePayload,
  type Metrics,
  type TradeLog,
} from "@/lib/tradeLogs";

export type PerformanceSnapshot = {
  loading: boolean;
  hasTrades: boolean;
  trades: TradeLog[];
  metrics: Metrics;
  mentorPayload: MentorPerformancePayload | null;
  refresh: () => void;
};

export function usePerformance(limit = 20): PerformanceSnapshot {
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTradeLogs({ limit })
      .then((data) => {
        if (!cancelled) setTrades(data);
      })
      .catch(() => {
        if (!cancelled) setTrades([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, tick]);

  // Refresh when the user logs a new trade elsewhere in the app.
  useEffect(() => {
    const channel = supabase
      .channel("trade_logs_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trade_logs" },
        () => setTick((t) => t + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    loading,
    hasTrades: trades.length > 0,
    trades,
    metrics: computeMetrics(trades),
    mentorPayload: buildMentorPayload(trades),
    refresh: () => setTick((t) => t + 1),
  };
}
