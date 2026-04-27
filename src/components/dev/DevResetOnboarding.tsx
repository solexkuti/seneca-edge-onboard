import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";

/**
 * Dev-only floating button to restart the onboarding flow.
 * Renders ONLY in development (import.meta.env.DEV) — stripped from production builds.
 */
export default function DevResetOnboarding() {
  if (!import.meta.env.DEV) return null;

  const navigate = useNavigate();

  const reset = () => {
    try {
      // Clear known onboarding keys
      const keys = ["seneca_start_path", "seneca_profile"];
      keys.forEach((k) => window.localStorage.removeItem(k));
      // Also clear any other seneca_* keys defensively
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("seneca_"))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    navigate({ to: "/" });
    // Force a fresh mount of the onboarding flow
    window.setTimeout(() => window.location.reload(), 50);
  };

  return (
    <button
      type="button"
      onClick={reset}
      title="Dev: restart onboarding"
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition hover:text-foreground hover:bg-background"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Restart onboarding
      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
        dev
      </span>
    </button>
  );
}
