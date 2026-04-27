import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ControlHub from "@/components/control-hub/ControlHub";
import { getUserName } from "@/lib/userName";

export const Route = createFileRoute("/hub/")({
  head: () => ({
    meta: [
      { title: "Control Hub — SenecaEdge" },
      {
        name: "description",
        content:
          "Your trading command center: discipline, behavior, and decision tools.",
      },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  const [name, setName] = useState<string | undefined>(undefined);
  useEffect(() => setName(getUserName()), []);
  return <ControlHub userName={name} />;
}
