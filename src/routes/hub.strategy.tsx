import { createFileRoute } from "@tanstack/react-router";
import ComingSoonScreen from "@/components/feature/ComingSoonScreen";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/strategy")({
  head: () => ({
    meta: [{ title: "Strategy Builder — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      <ComingSoonScreen
        eyebrow="Strategy Builder"
        title="Define and refine your system."
        subtitle="Structure your edge."
        description="Build the rules that govern your entries, confirmations, risk, and grading — all in one place."
      />
    </RequireAuth>
  ),
});
