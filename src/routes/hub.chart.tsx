import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import TraderStateGate from "@/components/feature/TraderStateGate";
import ChartAnalyzer from "@/components/feature/ChartAnalyzer";

export const Route = createFileRoute("/hub/chart")({
  head: () => ({
    meta: [{ title: "Chart Analyzer — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      <TraderStateGate surface="Chart Analyzer">
        <ChartAnalyzer />
      </TraderStateGate>
    </RequireAuth>
  ),
});
