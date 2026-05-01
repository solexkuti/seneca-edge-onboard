// useSubscriptionTier — reads the current user's subscription tier.
//
// Tiers:
//   • free    — manual journal only
//   • pro     — manual MT5 CSV upload + everything in free
//   • premium — automatic broker sync (MetaApi / EA webhook) + everything in pro
//
// SenecaEdge philosophy: never block users. If the tier check fails or the
// profile row is missing, we default to "free" gracefully — the UI shows the
// upgrade path, never an error wall.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Tier = "free" | "pro" | "premium";

interface State {
  tier: Tier;
  loading: boolean;
  isPro: boolean;
  isPremium: boolean;
}

export function useSubscriptionTier(): State {
  const [tier, setTier] = useState<Tier>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (!cancelled) {
          setTier("free");
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setTier("free");
      } else {
        const t = (data as { subscription_tier?: Tier }).subscription_tier;
        setTier(t === "pro" || t === "premium" ? t : "free");
      }
      setLoading(false);
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    tier,
    loading,
    isPro: tier === "pro" || tier === "premium",
    isPremium: tier === "premium",
  };
}
