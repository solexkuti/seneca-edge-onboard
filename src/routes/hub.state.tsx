import { createFileRoute } from "@tanstack/react-router";
import ComingSoonScreen from "@/components/feature/ComingSoonScreen";

export const Route = createFileRoute("/hub/state")({
  head: () => ({
    meta: [{ title: "In-Trade Check — SenecaEdge" }],
  }),
  component: () => (
    <ComingSoonScreen
      eyebrow="In-Trade Check"
      title="Pause before you act."
      subtitle="Real-time awareness during an active trade."
      description="Interrupt impulse, regain control, and make the next decision consciously — not reactively."
    />
  ),
});
