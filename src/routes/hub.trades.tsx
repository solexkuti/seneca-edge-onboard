import { createFileRoute } from "@tanstack/react-router";
import TradeJournal from "@/components/feature/TradeJournal";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/trades")({
  head: () => ({
    meta: [
      { title: "Trade Journal — SenecaEdge" },
      { name: "description", content: "Every trade you've logged, with full structured detail." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <TradeJournal />
    </RequireAuth>
  ),
});
