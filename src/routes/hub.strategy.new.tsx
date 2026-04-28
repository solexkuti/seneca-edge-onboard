import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import StrategyBuilder from "@/components/feature/StrategyBuilder";

export const Route = createFileRoute("/hub/strategy/new")({
  head: () => ({
    meta: [{ title: "New strategy — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      <StrategyBuilder />
    </RequireAuth>
  ),
});
