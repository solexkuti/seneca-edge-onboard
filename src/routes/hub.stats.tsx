import { createFileRoute } from "@tanstack/react-router";
import TradeStats from "@/components/feature/TradeStats";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/stats")({
  head: () => ({
    meta: [
      { title: "Trade Stats — SenecaEdge" },
      { name: "description", content: "Win rate, PnL, RR, profit factor — from your real trades." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <TradeStats />
    </RequireAuth>
  ),
});
