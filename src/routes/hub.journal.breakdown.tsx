import { createFileRoute } from "@tanstack/react-router";
import BehaviorBreakdown from "@/components/feature/BehaviorBreakdown";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/journal/breakdown")({
  head: () => ({
    meta: [
      { title: "Behavior Breakdown — SenecaEdge" },
      {
        name: "description",
        content:
          "Asset behavior, rule violations, and the patterns shaping your edge.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <BehaviorBreakdown />
    </RequireAuth>
  ),
});

