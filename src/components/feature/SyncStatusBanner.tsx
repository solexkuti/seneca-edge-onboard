// SyncStatusBanner — behavioral nudge surfaced on the Connections page.
//
// Reads the user's recent `mt5_imports` history and produces one of:
//   • repeat-uploader  — "You've uploaded N times in the last 7 days. Let
//                        Seneca pull it automatically."
//   • stale-sync       — "Your last sync was X days ago. Real-time data
//                        keeps your behavior score honest."
//   • none             — nothing to show (first-time visitor or already
//                        on premium).
//
// Tone: never lecturing. Frames automation as *the natural next step*, not
// a failure of the user. Premium users see nothing.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";

type Nudge =
  | { kind: "repeat"; count: number }
  | { kind: "stale"; days: number }
  | null;

const ease = [0.22, 1, 0.36, 1] as const;

export function SyncStatusBanner() {
  const { isPremium, loading: tierLoading } = useSubscriptionTier();
  const [nudge, setNudge] = useState<Nudge>(null);

  useEffect(() => {
    let cancelled = false;
    if (isPremium || tierLoading) return;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from("mt5_imports")
        .select("created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled || error || !data) return;

      const now = Date.now();
      const sevenDays = 7 * 86400_000;
      const recent = data.filter(
        (r) => now - new Date(r.created_at).getTime() <= sevenDays,
      );

      if (recent.length >= 2) {
        setNudge({ kind: "repeat", count: recent.length });
        return;
      }
      if (data.length > 0) {
        const last = new Date(data[0].created_at).getTime();
        const days = Math.floor((now - last) / 86400_000);
        if (days >= 3) setNudge({ kind: "stale", days });
        return;
      }
      // No imports yet → no nudge (the empty state on the page handles intro).
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isPremium, tierLoading]);

  if (isPremium || tierLoading || !nudge) return null;

  const Icon = nudge.kind === "repeat" ? Sparkles : Clock;
  const headline =
    nudge.kind === "repeat"
      ? `${nudge.count} uploads in the last week`
      : `Last sync was ${nudge.days} day${nudge.days === 1 ? "" : "s"} ago`;
  const body =
    nudge.kind === "repeat"
      ? "You're doing the work Seneca was built to do for you. Let automation take over so you can focus on the chart, not the spreadsheet."
      : "Behavior insights work best on fresh data. Premium pulls every closed deal in real-time — no more uploads, no more gaps.";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease }}
        className="rounded-2xl border border-[#C6A15B]/25 bg-gradient-to-br from-[#1A1612] to-[#18181A] p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C6A15B]/15 ring-1 ring-[#C6A15B]/30">
            <Icon className="h-4 w-4 text-[#E7C98A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-[#C6A15B]">
              Automation suggested
            </p>
            <h3 className="mt-1 font-serif text-[17px] tracking-tight text-[#EDEDED]">
              {headline}
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9A9A9A]">
              {body}
            </p>
          </div>
          <Link
            to="/hub/connections/automate"
            className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#C6A15B] px-3.5 py-2 text-[12px] font-medium text-[#0B0B0D] transition-colors hover:bg-[#E7C98A]"
          >
            See options
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Link
          to="/hub/connections/automate"
          className="mt-3 inline-flex sm:hidden items-center gap-1.5 rounded-lg bg-[#C6A15B] px-3.5 py-2 text-[12px] font-medium text-[#0B0B0D] hover:bg-[#E7C98A]"
        >
          See options <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
