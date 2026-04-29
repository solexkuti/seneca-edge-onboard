import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout-only route. Children (index = Log Trade flow, /history = read-only
// trade history, /breakdown = mistake breakdown) render via <Outlet />.
// Do NOT mount BehavioralJournalFlow here — it would leak into every child
// route and trigger the log-trade flow when the user opens History.
export const Route = createFileRoute("/hub/journal")({
  component: () => <Outlet />,
});
