import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pathless parent layout for /hub/strategy/* children (new, $id, index).
// Required so the route generator can resolve HubStrategyRoute as a parent
// for hub.strategy.new.tsx and hub.strategy.$id.tsx. Without this layout
// file, routeTree.gen.ts references an undefined HubStrategyRoute and the
// router crashes with "undefined is not an object (evaluating 'match._nonReactive')".
export const Route = createFileRoute("/hub/strategy")({
  component: () => <Outlet />,
});
