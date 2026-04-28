// Central feature flag for the enforcement systems (lock screens, recovery
// flow, discipline penalties). Set VITE_DISABLE_ENFORCEMENT=true in .env to
// bypass `not_confirmed` and `discipline_locked` gates while routing /
// onboarding stabilizes. The `no_strategy` gate is NEVER bypassed because it
// IS the onboarding redirect — a user with no strategy must build one.
//
// Reading via a function (not a top-level const) keeps the value reactive to
// Vite HMR and avoids stale module-init evaluation during SSR.

export function enforcementDisabled(): boolean {
  try {
    return import.meta.env.VITE_DISABLE_ENFORCEMENT === "true";
  } catch {
    return false;
  }
}
