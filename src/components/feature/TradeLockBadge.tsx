// TradeLockBadge — small status indicator showing lock state.
// Drop into hub headers / nav to make the daily commitment visible.

import { Link } from "@tanstack/react-router";
import { ShieldCheck, Lock } from "lucide-react";
import { useTradeLock } from "@/hooks/useTradeLock";

export default function TradeLockBadge() {
  const { state, loading } = useTradeLock();
  if (loading || !state) return null;

  if (!state.trade_lock) {
    return (
      <span
        title="Trading is unlocked for today"
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-600/20"
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Checklist confirmed
      </span>
    );
  }

  return (
    <Link
      to="/hub/daily"
      title="Trading is locked — confirm today's checklist"
      className="inline-flex items-center gap-1.5 rounded-full bg-red-600/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-700 ring-1 ring-red-600/20 transition hover:bg-red-600/15"
    >
      <Lock className="h-3.5 w-3.5" aria-hidden />
      Checklist not confirmed
    </Link>
  );
}
