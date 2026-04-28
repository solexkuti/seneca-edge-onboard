// User-scoped localStorage.
//
// CRITICAL: Without this, every localStorage key is shared across whichever
// user happens to be signed in on the same browser — leaking journal entries,
// behavior history, daily checklist, cached name, etc. between accounts.
//
// All per-user client caches MUST go through `userKey(...)` so the storage
// key is namespaced by auth user id.
//
// On sign-in / sign-out we also wipe known legacy unscoped keys
// (`clearLegacyUnscopedKeys`) so data created before this change can never
// re-surface for a different user.

import { supabase } from "@/integrations/supabase/client";

let cachedUserId: string | null = null;

/** Read the current user id synchronously from the in-memory cache. */
export function getCachedUserId(): string | null {
  return cachedUserId;
}

/** Resolve current user id from Supabase session and cache it. */
export async function resolveUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
    return cachedUserId;
  } catch {
    return cachedUserId;
  }
}

/** Build a per-user namespaced storage key. Falls back to "anon" pre-auth. */
export function userKey(suffix: string): string {
  const uid = cachedUserId ?? "anon";
  return `u:${uid}:${suffix}`;
}

/**
 * Legacy unscoped keys created before per-user namespacing existed.
 * MUST be wiped on every auth state change so a previous user's data can't
 * leak to whoever signs in next.
 */
const LEGACY_KEYS = [
  "seneca:userName",
  "seneca_trading_journal",
  "seneca_check_history",
  "seneca.dailyChecklist.v1",
  "journal_pending_submissions_v1",
];

export function clearLegacyUnscopedKeys() {
  if (typeof window === "undefined") return;
  for (const k of LEGACY_KEYS) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Wipe every per-user namespaced key (`u:<uid>:*`) for a SPECIFIC previous
 * user id. Called on sign-out / user switch so the next account on the same
 * browser cannot read the prior user's caches.
 */
export function clearScopedKeysFor(uid: string | null) {
  if (typeof window === "undefined" || !uid) return;
  const prefix = `u:${uid}:`;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * Wire auth changes once at app boot. Updates the cached user id and clears
 * unscoped legacy keys whenever the user changes (sign-in, sign-out, switch).
 */
let installed = false;
export function installUserScopedStorage() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  void resolveUserId();
  // Always clear legacy keys on boot so a returning user never sees leftovers.
  clearLegacyUnscopedKeys();

  supabase.auth.onAuthStateChange((event, session) => {
    const next = session?.user?.id ?? null;
    if (next !== cachedUserId) {
      const prev = cachedUserId;
      cachedUserId = next;
      clearLegacyUnscopedKeys();
      if (prev && prev !== next) clearScopedKeysFor(prev);
    }
    if (event === "SIGNED_OUT") clearLegacyUnscopedKeys();
  });
}
