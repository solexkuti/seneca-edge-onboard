import { createFileRoute } from "@tanstack/react-router";
import ComingSoonScreen from "@/components/feature/ComingSoonScreen";

export const Route = createFileRoute("/hub/state")({
  head: () => ({
    meta: [{ title: "State Check — SenecaEdge" }],
  }),
  component: () => (
    <ComingSoonScreen
      eyebrow="State Check"
      title="Stay in control during live trades."
      subtitle="Real-time discipline tracking."
      description="A live monitor that watches your behavior mid-trade and warns you the second emotion takes over."
    />
  ),
});
