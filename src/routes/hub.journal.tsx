import { createFileRoute } from "@tanstack/react-router";
import BehavioralJournalFlow from "@/components/feature/BehavioralJournalFlow";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/journal")({
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
      <BehavioralJournalFlow />
    </RequireAuth>
  ),
});
