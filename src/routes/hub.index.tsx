import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import EdgeDashboard from "@/components/edge/EdgeDashboard";
import RequireAuth from "@/components/auth/RequireAuth";
import { getUserName, saveUserName } from "@/lib/userName";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/hub/")({
  head: () => ({
    meta: [
      { title: "Seneca Edge — Trading Intelligence" },
      {
        name: "description",
        content:
          "What is your strategy capable of vs what are you actually doing? A unified, data-driven view of your edge, behavior, and execution gap.",
      },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  const [name, setName] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const cached = getUserName();
    if (cached) setName(cached);

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .maybeSingle();
      const dbName =
        profile?.username && profile.username.trim()
          ? profile.username.trim()
          : undefined;
      if (cancelled) return;
      if (dbName) {
        setName(dbName);
        if (dbName !== cached) saveUserName(dbName);
      }

      try {
        if (window.sessionStorage.getItem("seneca:welcomeBack") === "1") {
          window.sessionStorage.removeItem("seneca:welcomeBack");
          const display = dbName ?? cached;
          toast(display ? `Welcome back, ${display}` : "Welcome back", {
            description: "Your edge is right where you left it.",
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RequireAuth>
      <EdgeDashboard userName={name} />
    </RequireAuth>
  );
}
