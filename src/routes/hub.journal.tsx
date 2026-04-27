import { createFileRoute } from "@tanstack/react-router";
import ComingSoonScreen from "@/components/feature/ComingSoonScreen";

export const Route = createFileRoute("/hub/journal")({
  head: () => ({
    meta: [{ title: "Trading Journal — SenecaEdge" }],
  }),
  component: () => (
    <ComingSoonScreen
      eyebrow="Trading Journal"
      title="See the patterns you keep repeating."
      subtitle="Behavior-tagged trade history."
      description="Every trade automatically tagged with the behavior behind it. Win rate is just the surface."
    />
  ),
});
