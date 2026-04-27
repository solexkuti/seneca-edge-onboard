import { createFileRoute } from "@tanstack/react-router";
import ComingSoonScreen from "@/components/feature/ComingSoonScreen";

export const Route = createFileRoute("/hub/mentor")({
  head: () => ({
    meta: [{ title: "AI Mentor — SenecaEdge" }],
  }),
  component: () => (
    <ComingSoonScreen
      eyebrow="AI Mentor"
      title="Guided trading reflection."
      subtitle="A mirror, not an oracle."
      description="Structured prompts to help you process trades and stay aligned with your system."
    />
  ),
});
