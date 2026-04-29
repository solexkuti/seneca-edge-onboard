import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  useEffect(() => setName(getUserName()), []);
  return (
    <RequireAuth>
      <SenecaDashboard userName={name} />
    </RequireAuth>
  );
}
