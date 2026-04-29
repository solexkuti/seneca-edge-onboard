import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import SenecaDashboard from "@/components/dashboard/SenecaDashboard";
import { getUserName } from "@/lib/userName";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/")({
  head: () => ({
    meta: [
      { title: "Seneca Edge — Trading Intelligence" },
      {
        name: "description",
        content:
          "A calm, data-driven view of your trading: discipline, behavior, performance, and your emerging edge.",
      },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  const [name, setName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const n = getUserName();
    setName(n);
    // One-shot "Welcome back" for returning users (set in src/routes/index.tsx).
    try {
      if (window.sessionStorage.getItem("seneca:welcomeBack") === "1") {
        window.sessionStorage.removeItem("seneca:welcomeBack");
        toast(n ? `Welcome back, ${n}` : "Welcome back", {
          description: "Your edge is right where you left it.",
        });
      }
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <RequireAuth>
      <SenecaDashboard userName={name} />
    </RequireAuth>
  );
}
