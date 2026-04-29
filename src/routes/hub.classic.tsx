import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ControlHub from "@/components/control-hub/ControlHub";
import { getUserName } from "@/lib/userName";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/classic")({
  head: () => ({
    meta: [
      { title: "Classic Dashboard — SenecaEdge" },
      {
        name: "description",
        content: "Legacy SenecaEdge control hub.",
      },
    ],
  }),
  component: ClassicPage,
});

function ClassicPage() {
  const [name, setName] = useState<string | undefined>(undefined);
  useEffect(() => setName(getUserName()), []);
  return (
    <RequireAuth>
      <ControlHub userName={name} />
    </RequireAuth>
  );
}
