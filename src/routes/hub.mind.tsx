import { createFileRoute } from "@tanstack/react-router";
import CheckBeforeTradeFlow from "@/components/feature/CheckBeforeTradeFlow";
import RequireAuth from "@/components/auth/RequireAuth";
import TraderStateGate from "@/components/feature/TraderStateGate";

export const Route = createFileRoute("/hub/mind")({
  head: () => ({
    meta: [
      { title: "Check Before Trade — SenecaEdge" },
      {
        name: "description",
        content:
          "A psychological gate that slows you down before execution. Force conscious awareness.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <TraderStateGate surface="Trade Gate">
        <CheckBeforeTradeFlow />
      </TraderStateGate>
    </RequireAuth>
  ),
});
