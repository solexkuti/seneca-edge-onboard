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
    (async () => {
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

      // Authed — does this user already have a strategy?
      let hasStrategy = false;
      try {
        const bp = await getActiveBlueprint();
        hasStrategy = !!bp;
      } catch (e) {
        console.warn("[entry] strategy check failed", e);
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[entry] strategy_exists=", hasStrategy);
      }

      if (cancelled) return;
      if (hasStrategy) {
        navigate({ to: "/hub", replace: true });
      } else {
        // Authed but no strategy — drop them into the hub; TraderStateGate
        // will route them to /hub/strategy/new on first protected surface.
        navigate({ to: "/hub", replace: true });
      }
    })();
    return () => {
      cancelled = true;
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
