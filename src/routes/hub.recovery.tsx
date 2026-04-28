import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import RecoveryFlow from "@/components/feature/RecoveryFlow";

export const Route = createFileRoute("/hub/recovery")({
  head: () => ({
    meta: [
      { title: "Recovery — SenecaEdge" },
      {
        name: "description",
        content:
          "Forced reflection, strategy recommit, and cooldown before trading is unlocked.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <RecoveryFlow />
    </RequireAuth>
  ),
});
