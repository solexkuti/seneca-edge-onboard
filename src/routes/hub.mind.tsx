import { createFileRoute } from "@tanstack/react-router";
import ComingSoonScreen from "@/components/feature/ComingSoonScreen";

export const Route = createFileRoute("/hub/mind")({
  head: () => ({
    meta: [{ title: "Train Your Mind — SenecaEdge" }],
  }),
  component: () => (
    <ComingSoonScreen
      eyebrow="Train Your Mind"
      title="Check in before you trade."
      subtitle="A 60-second mental state scan."
      description="A guided pre-trade check that flags impulse, fatigue, and revenge urges before they cost you."
    />
  ),
});
