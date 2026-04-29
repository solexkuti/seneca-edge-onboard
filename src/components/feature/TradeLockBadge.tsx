// TradeLockBadge — non-blocking discipline indicator.
// Displays the current discipline score & state; never blocks the user.

import { useTraderState } from "@/hooks/useTraderState";
import { Activity } from "lucide-react";

function tone(state: string) {
  if (state === "in_control")
    return "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20";
  if (state === "slipping")
    return "bg-amber-500/10 text-amber-300 ring-amber-500/20";
  return "bg-rose-500/10 text-rose-300 ring-rose-500/20";
}

function label(state: string) {
  if (state === "in_control") return "Controlled";
  if (state === "slipping") return "Slight drift";
  return "Undisciplined";
}

export default function TradeLockBadge() {
  const { state } = useTraderState();
  if (state.loading) return null;

  return (
    <span
      title={`Discipline ${state.discipline.score}/100`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${tone(state.discipline.state)}`}
    >
      <Activity className="h-3.5 w-3.5" aria-hidden />
      {label(state.discipline.state)} · {state.discipline.score}
    </span>
  );
}
