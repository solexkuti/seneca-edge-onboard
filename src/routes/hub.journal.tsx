import { createFileRoute, Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import TradingJournalFlow from "@/components/feature/TradingJournalFlow";
import JournalExportButton from "@/components/feature/JournalExportButton";
import JournalSyncStatus from "@/components/feature/JournalSyncStatus";
import RequireAuth from "@/components/auth/RequireAuth";
import TraderStateGate from "@/components/feature/TraderStateGate";

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
  component: () => (
    <RequireAuth>
      <TraderStateGate surface="Trading Journal">
        <JournalRoute />
      </TraderStateGate>
    </RequireAuth>
  ),
});

function JournalRoute() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2 sm:right-6 sm:top-6">
        <div className="pointer-events-auto">
          <JournalSyncStatus />
        </div>
        <div className="pointer-events-auto">
          <Link
            to="/hub/journal/history"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition hover:bg-card hover:text-foreground"
            aria-label="View journal history"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Link>
        </div>
        <div className="pointer-events-auto">
          <JournalExportButton />
        </div>
      </div>
      <TradingJournalFlow />
    </div>
  );
}
