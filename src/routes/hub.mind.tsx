import { createFileRoute } from "@tanstack/react-router";
import CheckBeforeTradeFlow from "@/components/feature/CheckBeforeTradeFlow";
import RequireAuth from "@/components/auth/RequireAuth";

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
      <CheckBeforeTradeFlow />
    </RequireAuth>
  ),
});
