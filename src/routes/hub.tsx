import { createFileRoute, Outlet } from "@tanstack/react-router";
import HubLayout from "@/components/layout/HubLayout";
import { BehaviorStateProvider } from "@/lib/edge/BehaviorStateProvider";

// Layout route for all /hub/* pages. Provides:
//   1. The desktop-first sidebar + top bar chrome (HubLayout).
//   2. The unified BehaviorState SSOT — every hub feature (Dashboard, Mentor,
//      Alerts, Analyzer, Insights) reads from the same provider so state
//      cannot drift between surfaces.
function HubLayoutRoute() {
  return (
    <BehaviorStateProvider>
      <HubLayout>
        <Outlet />
      </HubLayout>
    </BehaviorStateProvider>
  );
}

export const Route = createFileRoute("/hub")({
  component: HubLayoutRoute,
});
