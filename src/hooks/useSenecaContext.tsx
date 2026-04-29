// useSenecaContext — unified read-only view of "what Seneca knows right now".
//
// Wraps the existing TraderStateProvider and adds the most recent journal
// and chart analyzer activity so every surface (Mentor, Dashboard,
// Analyzer, Checklist, Journal) reads from ONE source of truth.
//
// This hook does NOT mutate state, NOT duplicate scoring logic, and NOT
// re-implement RLS. It only composes existing helpers.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTraderState } from "@/hooks/useTraderState";
import type { TraderState } from "@/lib/traderState";
import { senecaBlock } from "@/lib/senecaVoice";

export type RecentJournalEntry = {
  id: string;
  created_at: string;
  market: string | null;
  outcome: string | null;
  notes: string | null;
};

export type RecentAnalysis = {
  id: string;
  created_at: string;
  verdict: string;
  chart_confidence: number;
  strategy_name: string | null;
};

export type SenecaContext = {
  loading: boolean;
  trader: TraderState;
  /** Mentor-tone block line for the current state, or null if nothing blocks. */
  blockLine: string | null;
  /** True when Seneca has enough context to act intelligently. */
  ready: boolean;
  recentJournal: RecentJournalEntry[];
  recentAnalyses: RecentAnalysis[];
  refresh: () => Promise<void>;
};

/**
 * One hook. Every Seneca-aware surface uses this and nothing else.
 */
export function useSenecaContext(): SenecaContext {
  const { state: trader, refresh: refreshTrader } = useTraderState();
  const [recentJournal, setRecentJournal] = useState<RecentJournalEntry[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const loadExtras = async () => {
    setLoadingExtras(true);
    try {
      const [{ data: journalRows }, { data: analysisRows }] = await Promise.all([
        supabase
          .from("trades")
          .select("id, created_at, market, result, executed_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("chart_analyses")
          .select("id, created_at, verdict, chart_confidence, strategy_name")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setRecentJournal(
        (journalRows ?? []).map((r) => ({
          id: r.id as string,
          created_at: (r.created_at ?? r.executed_at) as string,
          market: (r.market as string) ?? null,
          outcome: (r.result as string) ?? null,
          notes: null,
        })),
      );
      setRecentAnalyses(
        (analysisRows ?? []).map((r) => ({
          id: r.id as string,
          created_at: r.created_at as string,
          verdict: (r.verdict as string) ?? "invalid",
          chart_confidence: (r.chart_confidence as number) ?? 0,
          strategy_name: (r.strategy_name as string) ?? null,
        })),
      );
    } catch (e) {
      // Quiet failure — Mentor still works without recents.
      console.warn("[seneca-context] extras load failed", e);
    } finally {
      setLoadingExtras(false);
    }
  };

  useEffect(() => {
    void loadExtras();
  }, [trader.strategy?.blueprint?.id, trader.session.checklist_confirmed]);

  return {
    loading: trader.loading || loadingExtras,
    trader,
    blockLine: senecaBlock(trader.blocks),
    ready: !!trader.strategy?.blueprint && !trader.blocks.in_recovery,
    recentJournal,
    recentAnalyses,
    refresh: async () => {
      await refreshTrader();
      await loadExtras();
    },
  };
}
