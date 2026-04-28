import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { supabase } from "@/integrations/supabase/client";
import { getActiveBlueprint } from "@/lib/dbStrategyBlueprints";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SenecaEdge — Trade smarter, not harder." },
      {
        name: "description",
        content:
          "SenecaEdge is the trading AI that analyzes your chart in seconds and builds your decision system.",
      },
      { property: "og:title", content: "SenecaEdge — Trading AI" },
      {
        property: "og:description",
        content:
          "AI-powered trade setups, calculated entries, stops, and take profits. Your edge, built into every trade.",
      },
    ],
  }),
  component: Index,
});

// Entry router for the root URL.
//   - No session            → render onboarding (which contains SlideAuth)
//   - Session + no strategy → render onboarding (continues into SlideName/SlideAuth tail
//     for already-authed users, which the existing flow handles by redirecting to /hub)
//   - Session + strategy    → redirect to /hub immediately
//
// This is the missing "land in the right place on load" logic. We do NOT add a
// /login route — auth lives inside the onboarding flow's SlideAuth step.
function Index() {
  const navigate = useNavigate();
  const [decision, setDecision] = useState<"loading" | "onboarding">("loading");

  useEffect(() => {
    let cancelled = false;
    // Hard 4s failsafe: never leave the entry route on the spinner.
    const failsafe = window.setTimeout(() => {
      if (!cancelled) {
        console.warn("[entry] failsafe — rendering onboarding");
        setDecision("onboarding");
      }
    }, 4000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[entry] route=/ authed=", !!userId);
        }

        if (!userId) {
          if (!cancelled) setDecision("onboarding");
          return;
        }

        // Authed — check for an existing strategy with a 2s cap.
        // We don't actually need the answer to route correctly (both branches
        // go to /hub), so don't let a slow query hold the entry page.
        let hasStrategy = false;
        try {
          const bp = await Promise.race([
            getActiveBlueprint(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);
          hasStrategy = !!bp;
        } catch (e) {
          console.warn("[entry] strategy check failed", e);
        }

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[entry] strategy_exists=", hasStrategy);
        }

        if (cancelled) return;
        navigate({ to: "/hub", replace: true });
      } catch (err) {
        console.error("[entry] failed", err);
        if (!cancelled) setDecision("onboarding");
      } finally {
        window.clearTimeout(failsafe);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
    };
  }, [navigate]);

  if (decision === "loading") {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <OnboardingFlow />;
}
