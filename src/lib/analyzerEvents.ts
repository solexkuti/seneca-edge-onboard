// Analyzer Events — pre-trade decision quality, written every time the
// Chart Analyzer produces a verdict. Feeds the Discipline Engine alongside
// discipline_logs (which is execution quality, tied to actual trades).
//
// score_delta convention (raw event_score in [-20, +5]):
//   valid                         →  +5
//   weak                          →   0
//   invalid + 1 rule              →  -5
//   invalid + 2 rules             → -10
//   invalid + 3+ rules / critical → -20
//
// The full discipline score (which combines this with execution logs and
// applies recency weighting) lives in `@/lib/disciplineScore`. This file
// only persists the raw per-event number.

import { supabase } from "@/integrations/supabase/client";
import { eventScoreFor } from "@/lib/disciplineScore";

export type AnalyzerVerdict = "valid" | "weak" | "invalid";

export type AnalyzerEvent = {
  id: string;
  user_id: string;
  analysis_id: string | null;
  blueprint_id: string | null;
  verdict: AnalyzerVerdict;
  violations: string[];
  score_delta: number;
  reason: string | null;
  created_at: string;
};

export const ANALYZER_EVENT_LOGGED = "seneca:analyzer-event-logged";

export function broadcastAnalyzerEvent(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ANALYZER_EVENT_LOGGED));
  } catch {
    // ignore
  }
}

/** Back-compat shim — prefer `eventScoreFor(verdict, violations)` directly. */
export function scoreDeltaFor(verdict: AnalyzerVerdict): number {
  return eventScoreFor(verdict, []);
}

export async function logAnalyzerEvent(args: {
  analysis_id: string | null;
  blueprint_id: string | null;
  verdict: AnalyzerVerdict;
  violations: string[];
  reason?: string | null;
}): Promise<AnalyzerEvent | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  const score_delta = eventScoreFor(args.verdict, args.violations);
  const { data, error } = await supabase
    .from("analyzer_events")
    .insert({
      user_id: uid,
      analysis_id: args.analysis_id,
      blueprint_id: args.blueprint_id,
      verdict: args.verdict,
      violations: args.violations,
      score_delta,
      reason: args.reason ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[analyzer-events] insert failed:", error);
    return null;
  }
  broadcastAnalyzerEvent();
  // Centralized engine: refresh discipline_state + session_state snapshot.
  try {
    const { updateDiscipline } = await import("@/server/seneca.functions");
    void updateDiscipline().catch((e) =>
      console.warn("[analyzer-events] updateDiscipline failed:", e),
    );
  } catch (e) {
    console.warn("[analyzer-events] engine unavailable:", e);
  }
  return data as AnalyzerEvent;
}


export type RecentDecision = {
  source: "analyzer" | "execution";
  id: string;
  user_id: string;
  verdict: "valid" | "invalid" | "weak";
  score_delta: number;
  violations: unknown;
  trade_id: string | null;
  analysis_id: string | null;
  created_at: string;
};

export async function fetchRecentDecisions(limit = 20): Promise<RecentDecision[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("recent_decisions" as never)
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[recent-decisions] fetch failed:", error);
    return [];
  }
  return (data ?? []) as RecentDecision[];
}
