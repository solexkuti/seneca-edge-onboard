import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import TraderStateGate from "@/components/feature/TraderStateGate";
import AnalyzerLockScreen from "@/components/feature/AnalyzerLockScreen";
import ChartAnalyzer from "@/components/feature/ChartAnalyzer";

export const Route = createFileRoute("/hub/chart")({
  head: () => ({
    meta: [{ title: "Chart Analyzer — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      {/* Strategy is foundational: missing strategy hard-redirects to builder. */}
      <TraderStateGate surface="Chart Analyzer" enforce={["no_strategy"]}>
        {/* Strict analyzer lock: hides ALL analyzer UI and blocks uploads
           when the user is not in a controlled state. */}
        <AnalyzerLockScreen>
          <ChartAnalyzer />
        </AnalyzerLockScreen>
      </TraderStateGate>
    </RequireAuth>
  ),
});
