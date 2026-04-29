// Dev-only: reset the CURRENT user back to a brand-new state without
// deleting their auth account.
//
// Wipes every per-user row across the schema (RLS scopes the deletes to the
// signed-in user automatically), flips `onboarding_completed = false` on the
// profile, and clears every client-side cache. After this runs, the same
// email can sign in and the app behaves as if it's day one.
//
// Stripped from production via the `import.meta.env.DEV` guard at the
// callsite — this module should never be imported from non-dev surfaces.

import { supabase } from "@/integrations/supabase/client";

/** Tables that hold per-user data scoped by `user_id`. RLS handles auth. */
const USER_SCOPED_TABLES = [
  "trades",
  "journal_entries",
  "discipline_logs",
  "behavior_patterns",
  "chart_analyses",
  "analyzer_events",
  "checklist_confirmations",
  "daily_streaks",
  "discipline_state",
  "emotional_events",
  "lock_attempt_events",
  "pressure_events",
  "recovery_sessions",
  "session_state",
  "strategies",
  "strategy_blueprints",
  "trade_logs",
] as const;

export type ResetReport = {
  ok: boolean;
  userId: string | null;
  deleted: Record<string, "ok" | string>;
  profileReset: boolean;
};

/**
 * Wipe all data tied to the currently signed-in user and reset their
 * onboarding flag. Does NOT sign the user out and does NOT delete the
 * auth account — the same login keeps working.
 */
export async function resetCurrentUserAccount(): Promise<ResetReport> {
  const report: ResetReport = {
    ok: false,
    userId: null,
    deleted: {},
    profileReset: false,
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;
  report.userId = userId;
  if (!userId) return report;

  // Delete from each user-scoped table. RLS already restricts to this user,
  // but we add `user_id = userId` defensively.
  for (const table of USER_SCOPED_TABLES) {
    try {
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(table as any)
        .delete()
        .eq("user_id", userId);
      report.deleted[table] = error ? error.message : "ok";
    } catch (e) {
      report.deleted[table] = e instanceof Error ? e.message : "unknown error";
    }
  }

  // Reset profile flags so the entry router treats this user as first-time.
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_completed: false,
        onboarded_at: null,
        market: null,
        experience: null,
        challenge: null,
        goal: null,
        username: null,
      })
      .eq("id", userId);
    report.profileReset = !error;
  } catch {
    report.profileReset = false;
  }

  // Clear every client-side cache for this user (and any legacy unscoped keys).
  if (typeof window !== "undefined") {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith("seneca_") ||
          k.startsWith("seneca:") ||
          k.startsWith("u:")
        ) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) window.localStorage.removeItem(k);
      // Also clear any session UI flags (welcome-back toast, etc.)
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
  }

  report.ok = true;
  return report;
}
