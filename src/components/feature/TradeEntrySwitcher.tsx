// TradeEntrySwitcher — top-level toggle between Executed and Missed trade
// flows. Both flows write to the same `trades` table with `trade_type`
// distinguishing them. Default = Executed.

import { useState } from "react";
import { CheckCircle2, Eye } from "lucide-react";
import BehavioralJournalFlow from "./BehavioralJournalFlow";
import MissedTradeFlow from "./MissedTradeFlow";

type TabId = "executed" | "missed";

const TABS: { id: TabId; label: string; icon: typeof CheckCircle2; hint: string }[] = [
  { id: "executed", label: "Executed", icon: CheckCircle2, hint: "I took the trade" },
  { id: "missed", label: "Missed", icon: Eye, hint: "I saw it, didn't take it" },
];

export default function TradeEntrySwitcher() {
  const [tab, setTab] = useState<TabId>("executed");

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Trade type"
        className="grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-[#18181A]/60 p-1.5"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-[#C6A15B]/15 text-[#E7C98A] ring-1 ring-[#C6A15B]/40"
                  : "text-[#9A9A9A] hover:text-[#EDEDED]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{t.label}</span>
              <span className="hidden sm:inline text-[11px] text-[#5A5A5A] font-normal">
                · {t.hint}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "executed" ? <BehavioralJournalFlow /> : <MissedTradeFlow />}
    </div>
  );
}
