import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Wrench, X, UserPlus, LogIn, ShieldCheck, Eraser } from "lucide-react";
import { signOut } from "@/lib/auth";
import { resetCurrentUserAccount } from "@/lib/devResetAccount";
import {
  markOnboardingCompleted,
  clearOnboardingCompleted,
} from "@/lib/userState";

/**
 * Dev-only floating panel — completely stripped from production builds via
 * the `import.meta.env.DEV` guard.
 *
 * Layout rules:
 *  - Anchored bottom-LEFT (CTAs live bottom-right / bottom-center).
 *  - Sits ~96px above the viewport edge + respects iOS safe-area inset.
 *  - Collapses to a single small icon by default; expand on tap.
 *  - z-index 40 — below modals (z-50+).
 *
 * Actions when expanded — three explicit user-state simulators per the
 * authentication spec, plus the destructive "Reset account" tool:
 *
 *  1. Simulate New User       — clear session, clear hasCompletedOnboarding
 *                                → /onboarding (the entry router lands on /).
 *  2. Simulate Returning User — clear session, KEEP hasCompletedOnboarding
 *                                → /auth/sign-in.
 *  3. Simulate Logged In      — no-op on auth (keeps current session)
 *                                → /hub.
 *  4. Reset account            — wipes all DB data for the current user
 *                                (keeps login). Routes to onboarding.
 */
export default function DevResetOnboarding() {
  if (!import.meta.env.DEV) return null;

  const navigate = useNavigate();
  const [busy, setBusy] = useState<
    "none" | "new-user" | "returning" | "logged-in" | "reset"
  >("none");
  const [expanded, setExpanded] = useState(false);

  /** Wipe seneca_* / seneca: / u:* keys. Optionally preserve the onboarding flag. */
  const wipeLocalState = (preserveOnboardingFlag: boolean) => {
    try {
      const PRESERVE = preserveOnboardingFlag
        ? new Set(["seneca:hasCompletedOnboarding"])
        : new Set<string>();
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        if (PRESERVE.has(k)) continue;
        if (
          k.startsWith("seneca_") ||
          k.startsWith("seneca:") ||
          k.startsWith("u:")
        ) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) window.localStorage.removeItem(k);
      try {
        window.sessionStorage.clear();
      } catch {
        /* ignore */
      }
    } catch {
      /* noop */
    }
  };

  const simulateNewUser = async () => {
    if (busy !== "none") return;
    setBusy("new-user");
    wipeLocalState(false);
    clearOnboardingCompleted();
    await signOut();
    navigate({ to: "/" });
    window.setTimeout(() => window.location.reload(), 50);
  };

  const simulateReturningUser = async () => {
    if (busy !== "none") return;
    setBusy("returning");
    wipeLocalState(true);
    markOnboardingCompleted();
    await signOut();
    navigate({ to: "/auth/sign-in" });
    window.setTimeout(() => window.location.reload(), 50);
  };

  const simulateLoggedIn = async () => {
    if (busy !== "none") return;
    setBusy("logged-in");
    // Keep whatever session exists. If user isn't authed, this is a soft-fail
    // — the entry router will rebound them to onboarding/sign-in.
    markOnboardingCompleted();
    navigate({ to: "/hub" });
    setBusy("none");
  };

  const resetAccount = async () => {
    if (busy !== "none") return;
    const ok = window.confirm(
      "DEV: Reset this account?\n\nThis wipes ALL data for the current user (trades, journal, metrics, mentor context, profile) but KEEPS the login. The user will land on onboarding as if brand new.",
    );
    if (!ok) return;
    setBusy("reset");
    try {
      const report = await resetCurrentUserAccount();
      // eslint-disable-next-line no-console
      console.log("[dev] account reset:", report);
      if (!report.ok) {
        window.alert(
          "Reset failed — no signed-in user. Sign in first, then try again.",
        );
        setBusy("none");
        return;
      }
    } catch (e) {
      console.error("[dev] reset failed", e);
      window.alert("Reset failed. Check console for details.");
      setBusy("none");
      return;
    }
    clearOnboardingCompleted();
    navigate({ to: "/" });
    window.setTimeout(() => window.location.reload(), 50);
  };

  const wrapStyle: React.CSSProperties = {
    bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
    left: "calc(16px + env(safe-area-inset-left, 0px))",
  };

  const baseBtn =
    "flex w-full items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition hover:bg-background hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed";

  if (!expanded) {
    return (
      <div
        className="fixed z-40 opacity-85 hover:opacity-100 transition-opacity"
        style={wrapStyle}
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Dev tools"
          aria-label="Open dev tools"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground shadow-lg backdrop-blur transition hover:bg-background hover:text-foreground"
        >
          <Wrench className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed z-40 flex w-[200px] flex-col items-stretch gap-2 opacity-95 hover:opacity-100 transition-opacity"
      style={wrapStyle}
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        title="Hide dev tools"
        aria-label="Hide dev tools"
        className="flex items-center gap-1.5 self-start rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-lg backdrop-blur transition hover:text-foreground"
      >
        <X className="h-3 w-3" />
        Dev
      </button>

      <button
        type="button"
        onClick={simulateNewUser}
        disabled={busy !== "none"}
        title="Clear session + onboarding state, land on /onboarding"
        className={baseBtn}
      >
        <UserPlus className="h-3.5 w-3.5" />
        {busy === "new-user" ? "Loading…" : "Simulate New User"}
      </button>

      <button
        type="button"
        onClick={simulateReturningUser}
        disabled={busy !== "none"}
        title="Clear session, keep onboarding flag, land on /auth/sign-in"
        className={baseBtn}
      >
        <LogIn className="h-3.5 w-3.5" />
        {busy === "returning" ? "Loading…" : "Simulate Returning User"}
      </button>

      <button
        type="button"
        onClick={simulateLoggedIn}
        disabled={busy !== "none"}
        title="Route to /hub assuming current session"
        className={baseBtn}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {busy === "logged-in" ? "Loading…" : "Simulate Logged In User"}
      </button>

      <div className="my-1 h-px bg-border/40" />

      <button
        type="button"
        onClick={resetAccount}
        disabled={busy !== "none"}
        title="Wipe ALL data for the current user (keeps login)"
        className={baseBtn}
      >
        <Eraser className="h-3.5 w-3.5" />
        {busy === "reset" ? "Resetting…" : "Reset account data"}
      </button>
    </div>
  );
}
