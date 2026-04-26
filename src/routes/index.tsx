import { createFileRoute } from "@tanstack/react-router";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

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

function Index() {
  return <OnboardingFlow />;
}
