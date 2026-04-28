// Trade Lock — central client-side enforcement of the daily checklist gate.
//
// Mirrors the database trigger `enforce_trade_lock` so the UI can pre-empt
// blocked actions and explain *why* the user is locked. The DB is the source
// of truth — it will reject any insert that bypasses this check.
//
// Lock conditions:
//   - No checklist confirmation for today's date  → LOCKED
//   - 2+ undisciplined logs since last confirmation → LOCKED (re-lock)
//   - control_state at confirmation time was "out_of_control" without the
//     extra commitment ack → treated as not yet confirmed
//
// Unlock requires: a fresh `checklist_confirmations` row dated today.

import { supabase } from "@/integrations/supabase/client";

export type LockReason =
  | "not_confirmed_today"
  | "consecutive_breaks"
  | "out_of_control_unacked";

export type TradeLockState = {
  trade_lock: boolean;
  checklist_completed: boolean;
  checklist_confirmed_at: string | null;
  control_state: "in_control" | "at_risk" | "out_of_control" | null;
  reason: LockReason | null;
  message: string;
};

const REASON_MESSAGE: Record<LockReason, string> = {
  not_confirmed_today:
    "You have not confirmed your checklist for today.",
  consecutive_breaks:
    "Two undisciplined trades in a row — system re-locked. Re-confirm today's checklist.",
  out_of_control_unacked:
    "You're out of control today — extra commitment required before unlocking.",
};

export const TRADE_LOCK_EVENT = "seneca:trade-lock-changed";

export function broadcastLockChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(TRADE_LOCK_EVENT));
  } catch {
    // ignore
  }
}

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compute the live lock state for the signed-in user.
 * Always returns a definitive state — defaults to LOCKED on error.
 */
export async function fetchTradeLockState(): Promise<TradeLockState> {
  const locked = (
    reason: LockReason,
    confirmed_at: string | null = null,
    control_state: TradeLockState["control_state"] = null,
  ): TradeLockState => ({
    trade_lock: true,
    checklist_completed: false,
    checklist_confirmed_at: confirmed_at,
    control_state,
    reason,
    message: REASON_MESSAGE[reason],
  });

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return locked("not_confirmed_today");

  // 1) Most recent confirmation for today
  const { data: conf } = await supabase
    .from("checklist_confirmations")
    .select("confirmed_at,control_state,applied_restrictions")
    .eq("user_id", uid)
    .eq("generated_for", todayLabel())
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conf) return locked("not_confirmed_today");

  const confirmedAt = conf.confirmed_at as string;
  const controlState = conf.control_state as TradeLockState["control_state"];
  const restrictions = (conf.applied_restrictions ?? []) as string[];

  // Strict-mode commitment: if user was out_of_control they must have ticked
  // the extra "I understand…" commitment, recorded as a restriction tag.
  if (
    controlState === "out_of_control" &&
    !restrictions.includes("strict_mode_acknowledged")
  ) {
    return locked("out_of_control_unacked", confirmedAt, controlState);
  }

  // 2) Re-lock check — last 2 discipline logs since confirmation
  const { data: logs } = await supabase
    .from("discipline_logs")
    .select("followed_entry,followed_exit,followed_risk,followed_behavior,created_at")
    .eq("user_id", uid)
    .gte("created_at", confirmedAt)
    .order("created_at", { ascending: false })
    .limit(2);

  if (logs && logs.length >= 2) {
    const breaks = logs.filter(
      (l) =>
        !(
          l.followed_entry &&
          l.followed_exit &&
          l.followed_risk &&
          l.followed_behavior
        ),
    ).length;
    if (breaks >= 2) {
      return locked("consecutive_breaks", confirmedAt, controlState);
    }
  }

  // UNLOCKED
  return {
    trade_lock: false,
    checklist_completed: true,
    checklist_confirmed_at: confirmedAt,
    control_state: controlState,
    reason: null,
    message: "Checklist confirmed",
  };
}
