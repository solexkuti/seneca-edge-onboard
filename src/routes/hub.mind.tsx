import { createFileRoute } from "@tanstack/react-router";
import CheckBeforeTradeFlow from "@/components/feature/CheckBeforeTradeFlow";
import RequireAuth from "@/components/auth/RequireAuth";
import TradeLockGate from "@/components/feature/TradeLockGate";

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
      <TradeLockGate surface="Trade Gate">
        <CheckBeforeTradeFlow />
      </TradeLockGate>
    </RequireAuth>
  ),
});
