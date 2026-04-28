// Checklist confirmation — the user's commitment record for today's plan.
// Mentor and Trade Check both reference these to enforce accountability:
// "you broke rule 2 that you confirmed at 09:14".

import { supabase } from "@/integrations/supabase/client";

export type RuleAck = {
  id: string; // stable rule_id from the daily checklist (e.g. "entry-2")
  label: string;
  category: "entry" | "exit" | "risk" | "behavior" | "adaptive";
  confirmed: boolean;
};

export type ChecklistConfirmation = {
  id: string;
  user_id: string;
  generated_for: string; // YYYY-MM-DD
  confirmed_at: string;
  control_state: "in_control" | "at_risk" | "out_of_control";
  discipline_score: number;
  allowed_tiers: string[];
  applied_restrictions: string[];
  focus: string[];
  rule_acknowledgements: RuleAck[];
  strategy_name: string | null;
};

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchTodayConfirmation(): Promise<ChecklistConfirmation | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("checklist_confirmations")
    .select(
      "id,user_id,generated_for,confirmed_at,control_state,discipline_score,allowed_tiers,applied_restrictions,focus,rule_acknowledgements,strategy_name",
    )
    .eq("user_id", uid)
    .eq("generated_for", todayLabel())
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[checklist-confirm] fetch failed:", error);
    return null;
  }
  return data ? (data as unknown as ChecklistConfirmation) : null;
}

export type ConfirmationInput = {
  control_state: ChecklistConfirmation["control_state"];
  discipline_score: number;
  allowed_tiers: string[];
  applied_restrictions: string[];
  focus: string[];
  rule_acknowledgements: RuleAck[];
  strategy_name: string;
};

export async function recordConfirmation(
  input: ConfirmationInput,
): Promise<{ ok: true; row: ChecklistConfirmation } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: "Sign in required." };

  // Require every rule to be acknowledged — confirmation is binary.
  const allConfirmed = input.rule_acknowledgements.every((r) => r.confirmed);
  if (!allConfirmed) {
    return {
      ok: false,
      error: "Every rule must be ticked before locking today's checklist.",
    };
  }

  const { data, error } = await supabase
    .from("checklist_confirmations")
    .insert({
      user_id: uid,
      generated_for: todayLabel(),
      control_state: input.control_state,
      discipline_score: input.discipline_score,
      allowed_tiers: input.allowed_tiers,
      applied_restrictions: input.applied_restrictions,
      focus: input.focus,
      rule_acknowledgements: input.rule_acknowledgements,
      strategy_name: input.strategy_name,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[checklist-confirm] insert failed:", error);
    return { ok: false, error: error?.message ?? "Could not lock checklist." };
  }
  return { ok: true, row: data as ChecklistConfirmation };
}
