import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw, Loader2, ShieldAlert } from "lucide-react";
import { signOut } from "@/lib/auth";

/**
 * Dev-only "Reset Session" screen.
 *
 * Accessible at /dev/reset. The route component itself returns 404 in
 * production builds so the page is invisible to normal users.
 */
export const Route = createFileRoute("/dev/reset")({
  head: () => ({
    meta: [
      { title: "Reset Session" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DevResetPage,
});

function DevResetPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!import.meta.env.DEV) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-7xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            Page not found
          </h2>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleReset = async () => {
    setBusy(true);
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("seneca_") || k.startsWith("seneca:"))
        .forEach((k) => window.localStorage.removeItem(k));
      try {
        window.sessionStorage.clear();
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
    await signOut();
    navigate({ to: "/" });
    window.setTimeout(() => window.location.reload(), 80);
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <ShieldAlert className="h-3 w-3" />
          Dev only
        </div>
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-text-primary">
          Reset Session
        </h1>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-text-secondary">
          This will clear your auth session, wipe stored onboarding answers and
          username, and return you to the start of the flow. Use only for
          testing.
        </p>

        <ul className="mt-5 space-y-2 text-[12.5px] text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand/70" />
            Clear user session
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand/70" />
            Reset onboarding progress
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand/70" />
            Reset stored user data
          </li>
        </ul>

        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="interactive-glow mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-6 py-4 text-[15px] font-semibold text-white shadow-soft disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Resetting…
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              Restart from onboarding
            </>
          )}
        </button>

        <Link
          to="/"
          className="mt-3 block text-center text-[12px] font-medium text-text-secondary hover:text-text-primary"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
