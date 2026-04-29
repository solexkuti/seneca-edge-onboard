import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { supabase } from "@/integrations/supabase/client";
import { isOnboardingCompleted } from "@/lib/auth";

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
//   - No session                          → render onboarding (which contains SlideAuth)
//   - Session + onboarding_completed=true → returning user, jump to /hub with welcome flag
//   - Session + onboarding_completed=false → render onboarding to finish setup
//
// Auth lives inside the onboarding flow's SlideAuth step — there is no /login route.
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

        if (!userId) {
          if (!cancelled) setDecision("onboarding");
          return;
        }

        // Returning-user detection — explicit profile flag.
        const completed = await Promise.race([
          isOnboardingCompleted(userId),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
        ]);

        if (cancelled) return;

        if (completed) {
          // Mark for a one-shot "Welcome back" toast in /hub.
          try {
            window.sessionStorage.setItem("seneca:welcomeBack", "1");
          } catch {
            /* ignore */
          }
          navigate({ to: "/hub", replace: true });
          return;
        }

        // Authed but onboarding never finished — finish it.
        setDecision("onboarding");
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
