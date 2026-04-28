import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import ChartAnalyzer from "@/components/feature/ChartAnalyzer";

export const Route = createFileRoute("/hub/chart")({
  head: () => ({
    meta: [
      { title: "Chart Analyzer — SenecaEdge" },
      {
        name: "description",
        content:
          "Score a setup against your locked strategy. Deterministic engine, AI-assisted explanation.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ChartAnalyzer />
    </RequireAuth>
  ),
});

