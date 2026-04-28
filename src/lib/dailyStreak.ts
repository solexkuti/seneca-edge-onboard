// Daily streak read helpers. The streak itself is maintained server-side
// by a trigger on discipline_logs — this module is read-only on the client.

import { supabase } from "@/integrations/supabase/client";

export type DailyStreak = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_clean_date: string | null;
  last_break_date: string | null;
  identity_label: string;
  updated_at: string;
};

export async function fetchDailyStreak(): Promise<DailyStreak | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("daily_streaks")
    .select(
      "user_id,current_streak,longest_streak,last_clean_date,last_break_date,identity_label,updated_at",
    )
    .eq("user_id", uid)
    .maybeSingle();
  if (error) {
    console.error("[streak] fetch failed:", error);
    return null;
  }
  return (data as DailyStreak) ?? null;
}

/** Pure helper, mirrors the SQL function. Used for previews before the trigger fires. */
export function computeIdentityLabel(streak: number): string {
  if (streak <= 0) return "starting fresh";
  if (streak < 3) return `${streak} clean trade${streak === 1 ? "" : "s"}`;
  if (streak < 7) return `${streak} days disciplined`;
  if (streak < 14) return `${streak} days controlled`;
  if (streak < 30) return `${streak} days elite execution`;
  return `${streak} days locked in`;
}

/**
 * Escalation level — derived from the engine's behavior_patterns + streak,
 * not from the streak alone. The number controls UI tone (warning, strict, lockdown).
 */
export type EscalationLevel = 0 | 1 | 2 | 3;

export function computeEscalation(args: {
  consecutiveBreaks: number; // last N trades broken in a row
  hasRepeatPattern: boolean;
}): { level: EscalationLevel; label: string; description: string } {
  if (args.consecutiveBreaks >= 3 || args.hasRepeatPattern) {
    return {
      level: 3,
      label: "LOCKDOWN",
      description: "Repeated rule breaks. A+ setups only, with mandatory delay.",
    };
  }
  if (args.consecutiveBreaks === 2) {
    return {
      level: 2,
      label: "STRICT MODE",
      description: "Two broken trades in a row. Tightened tiers, pause before entry.",
    };
  }
  if (args.consecutiveBreaks === 1) {
    return {
      level: 1,
      label: "WARNING",
      description: "Last trade broke the plan. Read the checklist out loud before re-entry.",
    };
  }
  return {
    level: 0,
    label: "STABLE",
    description: "System holding. Standard rules apply.",
  };
}
