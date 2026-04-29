import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import SenecaDashboard from "@/components/feature/SenecaDashboard";
import { getUserName } from "@/lib/userName";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/")({
  head: () => ({
    meta: [
      { title: "Today — SenecaEdge" },
      {
        name: "description",
        content:
          "A live mirror of your discipline, decisions, and session state.",
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
