// TradeLockBadge — small status indicator for the global header.
// Reads from the unified TRADER_STATE so it stays in sync with every other
// surface (Analyzer verdicts, Daily checklist, Discipline lock).

import { Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, ShieldAlert } from "lucide-react";
import { useTraderState } from "@/hooks/useTraderState";

export default function TradeLockBadge() {
  const { state } = useTraderState();
  if (state.loading) return null;

  // Hard block: discipline lock takes priority over checklist not-confirmed.
  if (state.blocks.discipline_locked) {
    return (
      <Link
        to="/hub/daily"
        title={`Discipline locked — score ${state.discipline.score}/100`}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-600/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-700 ring-1 ring-red-600/20 transition hover:bg-red-600/15"
      >
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
        Discipline locked · {state.discipline.score}
      </Link>
    );
  }

  if (state.blocks.not_confirmed) {
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

  return (
    <span
      title={`Discipline ${state.discipline.score}/100 · ${state.discipline.state.replace("_", " ")}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-600/20"
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      Trading allowed · {state.discipline.score}
    </span>
  );
}
