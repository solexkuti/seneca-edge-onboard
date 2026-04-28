// Strategy Blueprint data layer.
// All queries are scoped to the authenticated user via RLS.

import { supabase } from "@/integrations/supabase/client";

export type AccountType = "prop" | "personal" | "demo";

export type StructuredRules = {
  entry: string[];
  confirmation: string[];
  risk: string[];
  behavior: string[];
  context: string[];
};

export type AmbiguityFlag = {
  area: keyof StructuredRules | "general";
  note: string;
};

export type RefinementQA = {
  question: string;
  answer: string;
  accepted: boolean;
};

export type TierStrictness = {
  a_plus: number;
  b_plus: number;
  c: number;
};

export type TierRules = {
  a_plus: string;
  b_plus: string;
  c: string;
};

export type ChecklistByTier = {
  a_plus: string[];
  b_plus: string[];
  c: string[];
};

export type StrategyBlueprint = {
  id: string;
  user_id: string;
  strategy_id: string | null;
  name: string;
  account_types: AccountType[];
  risk_per_trade_pct: number | null;
  daily_loss_limit_pct: number | null;
  max_drawdown_pct: number | null;
  raw_input: string | null;
  tier_strictness: TierStrictness;
  tier_rules: TierRules;
  structured_rules: Partial<StructuredRules>;
  ambiguity_flags: AmbiguityFlag[];
  refinement_history: RefinementQA[];
  checklist: Partial<ChecklistByTier>;
  trading_plan: string | null;
  locked: boolean;
  locked_at: string | null;
  version: number;
  status: "draft" | "parsed" | "refined" | "finalized" | "locked";
  current_step: BuilderStep;
  created_at: string;
  updated_at: string;
};

export type BuilderStep =
  | "account"
  | "risk"
  | "raw"
  | "tiers"
  | "parse"
  | "refine"
  | "output"
  | "export"
  | "lock";

export const EMPTY_RULES: StructuredRules = {
  entry: [],
  confirmation: [],
  risk: [],
  behavior: [],
  context: [],
};

export async function listBlueprints(): Promise<StrategyBlueprint[]> {
  const { data, error } = await supabase
    .from("strategy_blueprints")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as StrategyBlueprint[];
}

export async function getBlueprint(id: string): Promise<StrategyBlueprint | null> {
  const { data, error } = await supabase
    .from("strategy_blueprints")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as StrategyBlueprint | null;
}

export async function getActiveBlueprint(): Promise<StrategyBlueprint | null> {
  // Prefer the most recently locked blueprint; fall back to most recent finalized.
  const { data, error } = await supabase
    .from("strategy_blueprints")
    .select("*")
    .order("locked", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data?.[0] ?? null) as unknown as StrategyBlueprint | null;
  return row;
}

export async function createBlueprint(): Promise<StrategyBlueprint> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("strategy_blueprints")
    .insert({
      user_id: uid,
      name: "Untitled Strategy",
      account_types: [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as StrategyBlueprint;
}

/**
 * Reuse the user's most recent empty draft if one exists; otherwise create
 * a fresh one. Prevents the "11 Untitled Strategy drafts" pile-up caused by
 * StrictMode double-invoke and repeated visits to /hub/strategy/new.
 *
 * "Empty" = unlocked draft with no raw_input and no structured rules.
 */
let inflightFindOrCreate: Promise<StrategyBlueprint> | null = null;
export function findOrCreateDraft(): Promise<StrategyBlueprint> {
  if (inflightFindOrCreate) return inflightFindOrCreate;
  inflightFindOrCreate = (async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { data: existing, error: selErr } = await supabase
        .from("strategy_blueprints")
        .select("*")
        .eq("user_id", uid)
        .eq("locked", false)
        .eq("status", "draft")
        .is("raw_input", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (selErr) throw selErr;

      const empty = (existing?.[0] ?? null) as unknown as StrategyBlueprint | null;
      if (empty) {
        // eslint-disable-next-line no-console
        console.log("[blueprints] reusing empty draft", empty.id);
        return empty;
      }

      // eslint-disable-next-line no-console
      console.log("[blueprints] creating new draft");
      return await createBlueprint();
    } finally {
      // Clear AFTER a tick so concurrent callers in the same render share
      // the same promise; subsequent fresh calls get a new lookup.
      setTimeout(() => {
        inflightFindOrCreate = null;
      }, 0);
    }
  })();
  return inflightFindOrCreate;
}


export async function updateBlueprint(
  id: string,
  patch: Partial<StrategyBlueprint>,
): Promise<StrategyBlueprint> {
  const { data, error } = await supabase
    .from("strategy_blueprints")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as StrategyBlueprint;
}

export async function lockBlueprint(id: string): Promise<StrategyBlueprint> {
  return updateBlueprint(id, {
    locked: true,
    locked_at: new Date().toISOString(),
    status: "locked",
  });
}

export async function unlockBlueprint(id: string): Promise<StrategyBlueprint> {
  return updateBlueprint(id, {
    locked: false,
    locked_at: null,
    status: "finalized",
  });
}

export async function deleteBlueprint(id: string): Promise<void> {
  const { error } = await supabase
    .from("strategy_blueprints")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
