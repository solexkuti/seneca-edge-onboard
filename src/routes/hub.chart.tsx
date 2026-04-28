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
      {/* Strategy + discipline are foundational. discipline_locked redirects
         the user to /hub/recovery — the only way back into the system. */}
      <TraderStateGate
        surface="Chart Analyzer"
        enforce={["no_strategy", "discipline_locked"]}
      >
        {/* Checklist-only lock UI (kept as a soft inline screen so the user
           can still see the analyzer surface context). Discipline locks are
           handled upstream by the gate redirect. */}
        <AnalyzerLockScreen>
          <ChartAnalyzer />
        </AnalyzerLockScreen>
      </TraderStateGate>
    </RequireAuth>
  ),
});
