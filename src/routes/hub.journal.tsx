import { createFileRoute } from "@tanstack/react-router";
import TradingJournalFlow from "@/components/feature/TradingJournalFlow";
import JournalExportButton from "@/components/feature/JournalExportButton";

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
  component: JournalRoute,
});

function JournalRoute() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <div className="pointer-events-auto">
          <JournalExportButton />
        </div>
      </div>
      <TradingJournalFlow />
    </div>
  );
}
