// Lock attempt logging — records every time a user tries to open a locked
// surface (currently the Analyzer). Used later for behavior-pattern detection
// (e.g. "user keeps trying to force trades while in lock state").

import { supabase } from "@/integrations/supabase/client";

export type LockAttemptReason =
  | "checklist_not_confirmed"
  | "discipline_locked"
  | "no_strategy";

export async function logLockAttempt(args: {
  surface: "analyzer" | "journal" | "trade_gate";
  discipline_state: string;
  discipline_score: number;
  checklist_confirmed: boolean;
  reason: LockAttemptReason;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;

  const { error } = await supabase.from("lock_attempt_events").insert({
    user_id: uid,
    surface: args.surface,
    discipline_state: args.discipline_state,
    discipline_score: args.discipline_score,
    checklist_confirmed: args.checklist_confirmed,
    reason: args.reason,
  });

  if (error) {
    // Non-fatal — log but never break the UX.
    console.warn("[lock-attempts] insert failed:", error.message);
  }
}
