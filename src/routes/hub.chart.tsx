import { createFileRoute } from "@tanstack/react-router";
import ComingSoonScreen from "@/components/feature/ComingSoonScreen";
import RequireAuth from "@/components/auth/RequireAuth";
import TradeLockGate from "@/components/feature/TradeLockGate";

export const Route = createFileRoute("/hub/chart")({
  head: () => ({
    meta: [{ title: "Chart Analyzer — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      <TradeLockGate surface="Chart Analyzer">
        <ComingSoonScreen
          eyebrow="Chart Analyzer"
          title="Analyze your trade against your rules."
          subtitle="Decision clarity, on demand."
          description="Drop in your chart and get an instant read against your defined system. In active development."
        />
      </TradeLockGate>
    </RequireAuth>
  ),
});
