// React hook around loadSsot() — single source of truth for every metric.
// Re-loads on auth change and on the same events that drive TRADER_STATE
// (journal updates, analyzer events, lock changes).

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_ACCOUNT, EMPTY_METRICS, loadSsot, type Ssot } from "@/lib/ssot";
import { onAuthChange, onTraderStateChange } from "@/lib/traderState";
import { loadDisciplineBreakdown } from "@/lib/disciplineScore";

const EMPTY_SSOT: Ssot = {
  loading: true,
  user_id: null,
  account: EMPTY_ACCOUNT,
  trades: [],
  metrics: EMPTY_METRICS,
  behavior: {
    discipline_score: 100,
    rule_adherence: 1,
    clean_trades: 0,
    total_trades: 0,
    violation_count: 0,
    recent_violations: [],
  },
  // Filled on first load; ok to be a stub at boot.
  discipline: {
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
  },
};

export function useSsot(): { ssot: Ssot; refresh: () => Promise<void> } {
  const [ssot, setSsot] = useState<Ssot>(EMPTY_SSOT);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const next = await loadSsot();
      setSsot(next);
    } catch (e) {
      console.error("[ssot] load failed:", e);
      // Keep last-known state, just stop loading.
      setSsot((s) => ({ ...s, loading: false }));
      // Best-effort discipline read so score doesn't desync.
      try {
        const d = await loadDisciplineBreakdown();
        setSsot((s) => ({ ...s, discipline: d, behavior: { ...s.behavior, discipline_score: d.score } }));
      } catch {
        // Ignore secondary failure
      }
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const u1 = onTraderStateChange(() => void refresh());
    const u2 = onAuthChange(() => void refresh());
    return () => {
      u1();
      u2();
    };
  }, [refresh]);

  return { ssot, refresh };
}
