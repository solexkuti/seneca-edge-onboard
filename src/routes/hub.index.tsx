import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PremiumDashboard from "@/components/dashboard/PremiumDashboard";
import { getUserName, saveUserName } from "@/lib/userName";
import { supabase } from "@/integrations/supabase/client";

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
    let cancelled = false;
    // 1) Optimistic name from per-user local cache (instant render).
    const cached = getUserName();
    if (cached) setName(cached);

    // 2) Authoritative name from the DB profile — survives device changes
    //    and ensures returning users on a fresh browser still see their name.
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
        // Re-hydrate the local cache so other surfaces pick it up immediately.
        if (dbName !== cached) saveUserName(dbName);
      }

      // One-shot "Welcome back" for returning users (set in src/routes/index.tsx).
      // Fired AFTER we resolve the name so the toast always personalizes when possible.
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
  return <PremiumDashboard userName={name} />;
}

