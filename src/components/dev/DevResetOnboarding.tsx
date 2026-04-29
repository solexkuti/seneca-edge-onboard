import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Eraser } from "lucide-react";
import { signOut } from "@/lib/auth";
import { resetCurrentUserAccount } from "@/lib/devResetAccount";

/**
 * Dev-only floating panel — completely stripped from production builds via
 * the `import.meta.env.DEV` guard.
 *
 * Two actions:
 *  1. Restart session  — sign out + clear caches, land on onboarding fresh.
 *  2. Reset account    — keep the same login, but wipe ALL data tied to the
 *                        current user_id (trades, journal, metrics, mentor
 *                        history, profile flags) and route to onboarding.
 *                        Auth account is NOT deleted.
 */
export default function DevResetOnboarding() {
  if (!import.meta.env.DEV) return null;

  const navigate = useNavigate();
  const [busy, setBusy] = useState<"none" | "restart" | "reset">("none");

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
    // Hard reload onto the entry route — re-fetches profile and routes to
    // onboarding (since onboarding_completed is now false).
    navigate({ to: "/" });
    window.setTimeout(() => window.location.reload(), 50);
  };

  const baseBtn =
    "flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition hover:text-foreground hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={resetAccount}
        disabled={busy !== "none"}
        title="Dev: wipe ALL data for the current user (keeps login)"
        className={baseBtn}
      >
        <Eraser className="h-3.5 w-3.5" />
        {busy === "reset" ? "Resetting…" : "Reset account"}
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          dev
        </span>
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
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          dev
        </span>
      </button>
    </div>
  );
}
