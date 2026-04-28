// Data layer for chart_analyses + chart-analyses storage bucket.

import { supabase } from "@/integrations/supabase/client";
import type { ChartFeaturesPair, RuleBreakdown } from "@/lib/chartRuleCheck";

const BUCKET = "chart-analyses";

export type ChartAnalysisRow = {
  id: string;
  user_id: string;
  blueprint_id: string | null;
  strategy_name: string | null;
  exec_timeframe: string;
  higher_timeframe: string | null;
  exec_image_path: string;
  higher_image_path: string | null;
  is_chart: boolean;
  chart_confidence: number;
  chart_reason: string | null;
  features: ChartFeaturesPair;
  rule_breakdown: RuleBreakdown;
  verdict: "valid" | "weak" | "invalid";
  ai_insight: string | null;
  trade_id: string | null;
  created_at: string;
};

export async function uploadChartImage(
  file: File,
  label: "exec" | "higher",
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const ext = file.name.split(".").pop() || "png";
  const path = `${uid}/${Date.now()}-${label}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedUrl(path: string, ttlSeconds = 600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function saveChartAnalysis(
  row: Omit<ChartAnalysisRow, "id" | "user_id" | "created_at">,
): Promise<ChartAnalysisRow> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("chart_analyses")
    .insert({ ...row, user_id: uid } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as ChartAnalysisRow;
}

export async function getChartAnalysis(id: string): Promise<ChartAnalysisRow | null> {
  const { data, error } = await supabase
    .from("chart_analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ChartAnalysisRow | null;
}

export async function attachAnalysisToTrade(
  analysisId: string,
  tradeId: string,
): Promise<void> {
  await supabase
    .from("chart_analyses")
    .update({ trade_id: tradeId } as never)
    .eq("id", analysisId);
}
