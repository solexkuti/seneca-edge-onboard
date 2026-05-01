import { createFileRoute } from "@tanstack/react-router";
import TradeEntrySwitcher from "@/components/feature/TradeEntrySwitcher";
import RequireAuth from "@/components/auth/RequireAuth";

// /hub/journal — Log Trade flow. Strictly the index of the journal section;
// /hub/journal/history must NOT initialize this flow (read-only).
export const Route = createFileRoute("/hub/journal/")({
  head: () => ({
    meta: [
      { title: "Log Trade — SenecaEdge" },
      {
        name: "description",
        content: "Log a trade. Seneca measures the behavior, not the outcome.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <TradeEntrySwitcher />
    </RequireAuth>
  ),
});
