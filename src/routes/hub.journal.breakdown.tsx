import { createFileRoute } from "@tanstack/react-router";
import MistakeBreakdown from "@/components/feature/MistakeBreakdown";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/journal/breakdown")({
  head: () => ({
    meta: [
      { title: "Mistake Breakdown — SenecaEdge" },
      {
        name: "description",
        content: "See which mistakes show up most and how each one affects your win rate.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <MistakeBreakdown />
    </RequireAuth>
  ),
});
