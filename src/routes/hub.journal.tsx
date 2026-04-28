import { createFileRoute, Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import TradingJournalFlow from "@/components/feature/TradingJournalFlow";
import JournalExportButton from "@/components/feature/JournalExportButton";
import JournalSyncStatus from "@/components/feature/JournalSyncStatus";
import RequireAuth from "@/components/auth/RequireAuth";
import TradeLockGate from "@/components/feature/TradeLockGate";

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
      <TradeLockGate surface="Trading Journal">
        <JournalRoute />
      </TradeLockGate>
    </RequireAuth>
  ),
});

function JournalRoute() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-4 top-4 z-30 sm:right-6 sm:top-6 flex items-center gap-2">
        <div className="pointer-events-auto">
          <JournalSyncStatus />
        </div>
        <div className="pointer-events-auto">
          <Link
            to="/hub/journal/history"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur transition hover:bg-background/80 active:scale-[0.98]"
            aria-label="View journal history"
          >
            <History className="h-4 w-4" />
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
