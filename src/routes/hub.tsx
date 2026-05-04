import { createFileRoute, Outlet } from "@tanstack/react-router";
import HubLayout from "@/components/layout/HubLayout";

// Layout route for all /hub/* pages. Provides the new desktop-first
// sidebar + top bar chrome without touching individual page logic.
function HubLayoutRoute() {
  return (
    <HubLayout>
      <Outlet />
    </HubLayout>
  );
}

export const Route = createFileRoute("/hub")({
  component: HubLayoutRoute,
});
