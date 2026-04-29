import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Eraser, Wrench, X } from "lucide-react";
import { signOut } from "@/lib/auth";
import { resetCurrentUserAccount } from "@/lib/devResetAccount";

/**
 * Dev-only floating panel — completely stripped from production builds via
 * the `import.meta.env.DEV` guard.
 *
 * Layout rules:
 *  - Anchored bottom-LEFT (CTAs and primary actions live bottom-right /
 *    bottom-center, so the left corner stays clear).
 *  - Sits ~96px above the viewport edge + respects iOS safe-area inset, so
 *    it never overlaps a primary "Continue" button.
 *  - Collapses to a single small icon by default; expand on tap.
 *  - z-index 40 — below modals (which use z-50+) so it never blocks dialogs.
 *  - 85% opacity at rest, 100% on hover/expand — visible but not dominant.
 *
 * Two actions when expanded:
 *  1. Restart session  — sign out + clear caches, land on onboarding fresh.
 *  2. Reset account    — keep the same login, but wipe ALL data tied to the
 *                        current user_id and route to onboarding.
 */
export default function DevResetOnboarding() {
  if (!import.meta.env.DEV) return null;

  const navigate = useNavigate();
  const [busy, setBusy] = useState<"none" | "restart" | "reset">("none");
  const [expanded, setExpanded] = useState(false);

  const restart = async () => {
    if (busy !== "none") return;
    setBusy("restart");
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("seneca_") || k.startsWith("seneca:"))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    await signOut();
    navigate({ to: "/" });
    window.setTimeout(() => window.location.reload(), 50);
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
    navigate({ to: "/" });
    window.setTimeout(() => window.location.reload(), 50);
  };

  // Anchor: bottom-left, lifted above CTAs, with safe-area padding.
  // z-40 keeps it strictly below modal overlays (which run z-50+).
  const wrapStyle: React.CSSProperties = {
    bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
    left: "calc(16px + env(safe-area-inset-left, 0px))",
  };

  const baseBtn =
    "flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition hover:bg-background hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed";

  // Collapsed state: tiny icon-only chip.
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
      className="fixed z-40 flex flex-col items-start gap-2 opacity-90 hover:opacity-100 transition-opacity"
      style={wrapStyle}
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        title="Hide dev tools"
        aria-label="Hide dev tools"
        className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-lg backdrop-blur transition hover:text-foreground"
      >
        <X className="h-3 w-3" />
        Dev
      </button>

      <button
        type="button"
        onClick={resetAccount}
        disabled={busy !== "none"}
        title="Dev: wipe ALL data for the current user (keeps login)"
        className={baseBtn}
      >
        <Eraser className="h-3.5 w-3.5" />
        {busy === "reset" ? "Resetting…" : "Reset account"}
      </button>

      <button
        type="button"
        onClick={restart}
        disabled={busy !== "none"}
        title="Dev: restart session (clears auth + onboarding)"
        className={baseBtn}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {busy === "restart" ? "Restarting…" : "Restart session"}
      </button>
    </div>
  );
}
