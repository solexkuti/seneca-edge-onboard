import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import TradeLockGate from "@/components/feature/TradeLockGate";
import ChartAnalyzer from "@/components/feature/ChartAnalyzer";

export const Route = createFileRoute("/hub/chart")({
  head: () => ({
    meta: [{ title: "Chart Analyzer — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      <TradeLockGate surface="Chart Analyzer">
        <ChartAnalyzer />
      </TradeLockGate>
    </RequireAuth>
  ),
});
