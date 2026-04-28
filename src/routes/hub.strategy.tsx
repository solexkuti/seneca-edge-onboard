import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pathless parent layout for /hub/strategy/* (new, $id, index).
// MUST use a stable named component reference — an inline arrow
// (`component: () => <Outlet />`) creates a new function on every render
// and can produce "undefined is not an object (evaluating 'match._nonReactive')"
// inside @tanstack/router-core during match resolution.
function HubStrategyLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/hub/strategy")({
  component: HubStrategyLayout,
});
