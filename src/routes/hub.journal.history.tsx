import { createFileRoute } from "@tanstack/react-router";
import TradeHistory from "@/components/feature/TradeHistory";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/journal/history")({
  head: () => ({
    meta: [
      { title: "Trade History — SenecaEdge" },
      { name: "description", content: "Every trade with score impact and screenshots." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <TradeHistory />
    </RequireAuth>
  ),
});
