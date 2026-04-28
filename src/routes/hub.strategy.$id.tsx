import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import StrategyBuilder from "@/components/feature/StrategyBuilder";

export const Route = createFileRoute("/hub/strategy/$id")({
  head: () => ({
    meta: [{ title: "Edit strategy — SenecaEdge" }],
  }),
  component: () => {
    const { id } = Route.useParams();
    return (
      <RequireAuth>
        <StrategyBuilder blueprintId={id} />
      </RequireAuth>
    );
  },
});
