import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { signOut } from "@/lib/auth";

/**
 * Dev-only floating button to fully restart the session.
 * Clears local onboarding state AND the auth session, then sends the user
 * back to the onboarding flow. Renders ONLY in development — completely
 * stripped from production builds via the `import.meta.env.DEV` guard.
 */
export default function DevResetOnboarding() {
  if (!import.meta.env.DEV) return null;

  const navigate = useNavigate();

  const reset = async () => {
    try {
      // Clear all seneca_* + seneca: localStorage keys defensively.
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("seneca_") || k.startsWith("seneca:"))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    // End the auth session as well so we land truly fresh.
    await signOut();
    navigate({ to: "/" });
    window.setTimeout(() => window.location.reload(), 50);
  };

  return (
    <button
      type="button"
      onClick={reset}
      title="Dev: restart session (clears auth + onboarding)"
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition hover:text-foreground hover:bg-background"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Restart session
      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
        dev
      </span>
    </button>
  );
}
