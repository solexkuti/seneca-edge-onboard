import { createFileRoute } from "@tanstack/react-router";
import TradingJournalFlow from "@/components/feature/TradingJournalFlow";

export const Route = createFileRoute("/hub/journal")({
  head: () => ({
    meta: [
      { title: "Trading Journal — SenecaEdge" },
      {
        name: "description",
        content:
          "Log trades, capture behavior, and feed your discipline system.",
      },
    ],
  }),
  component: TradingJournalFlow,
});
