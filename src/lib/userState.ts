// Local user-state flags that persist across sign-out.
//
// Why local? The single source of truth for "has this user completed
// onboarding" is the `profiles.onboarding_completed` column in the
// database — but that's only readable AFTER the user signs in. For the
// pre-auth entry router we need a synchronous, offline-friendly hint so
// returning users land on /auth/sign-in instead of repeating onboarding
// every time they reinstall, log out, or open the app on a new tab.
//
// This flag is intentionally NOT user-scoped. It represents "this device
// has seen a completed onboarding at least once" and is preserved across
// signOut() and "Restart session" actions (per spec section 3 + 9).

const KEY = "seneca:hasCompletedOnboarding";

export function markOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasCompletedOnboardingLocal(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
