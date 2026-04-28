// ============================================================================
// AI Explanation Layer (READ-ONLY)
// ----------------------------------------------------------------------------
// This module is allowed to:
//   1. Parse raw user strategy into structured rules (via parse-strategy fn)
//   2. Run the refinement loop (via validate-refinement-answer fn)
//   3. Generate human-readable checklist text
//   4. Generate the trading plan narrative
//   5. Provide post-trade feedback explanations
//
// It is FORBIDDEN from:
//   - mutating any rule's `result`
//   - producing scores
//   - overriding ValidationOutput
//   - inferring missing confirmations
//
// All functions here take the deterministic engine's ValidationOutput as
// INPUT and return STRINGS only. They never reach back into the engine.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import type { ValidationOutput, StructuredRule, CompletenessIssue } from "./ruleEngine";

/** Render a checklist line. Pure — no AI call. */
export function renderChecklistLine(rule: StructuredRule): string {
  const mark = rule.result ? "✓" : "✗";
  return `${mark} [${rule.type}] ${rule.condition}`;
}

/** Build a static, deterministic feedback summary (no AI). */
export function staticFeedback(out: ValidationOutput): string {
  const lines: string[] = [];
  lines.push(`Score: ${out.score}/100 — Tier ${out.tier}`);
  lines.push(`Discipline: ${out.discipline.replace(/_/g, " ")}`);
  if (out.violations.length === 0) {
    lines.push("All rule categories passed.");
  } else {
    lines.push("Violations:");
    for (const v of out.violations) lines.push(`  • ${v}`);
  }
  return lines.join("\n");
}

/**
 * Optional AI-generated narrative explanation. Calls the mentor-chat edge
 * function with a strict instruction that it must NOT change any score or
 * rule — only explain in plain English. Falls back to the static summary
 * on any error.
 */
export async function explainValidation(out: ValidationOutput): Promise<string> {
  try {
    const prompt = [
      "You are a trading mentor. Explain the following trade evaluation in 3-4 sentences.",
      "RULES:",
      "- Do NOT recompute the score.",
      "- Do NOT contradict the violations list.",
      "- Do NOT predict the market.",
      "- Speak directly about discipline and the listed violations only.",
      "",
      "Evaluation JSON:",
      JSON.stringify(
        { score: out.score, tier: out.tier, violations: out.violations, discipline: out.discipline },
        null,
        2,
      ),
    ].join("\n");

    const { data, error } = await supabase.functions.invoke("mentor-chat", {
      body: {
        messages: [{ role: "user", content: prompt }],
        mode: "explain_validation",
      },
    });
    if (error) throw error;
    const text =
      (data as { reply?: string; content?: string } | null)?.reply ??
      (data as { content?: string } | null)?.content;
    return typeof text === "string" && text.trim().length > 0 ? text.trim() : staticFeedback(out);
  } catch {
    return staticFeedback(out);
  }
}

/**
 * Failsafe handoff to AI for clarification when the engine reports
 * completeness issues. Returns a list of human-readable questions the UI
 * can show to the user. The AI is NOT allowed to invent rules — it can
 * only ask.
 */
export function clarificationPrompts(issues: CompletenessIssue[]): string[] {
  return issues.map((i) => {
    if (i.area === "general") return `Strategy is incomplete: ${i.reason}`;
    return `Please clarify your ${i.area} rule — ${i.reason}`;
  });
}
