// MistakeBreakdown — groups journal entries by mistake type and shows
// count, win rate, and avg R for each. Read-only insight surface.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useBehavioralJournal } from "@/hooks/useBehavioralJournal";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  MISTAKES,
  MISTAKE_LABEL,
  SEVERE_IDS,
  type MistakeId,
} from "@/lib/behavioralJournal";

type PresetId = "7d" | "30d" | "90d" | "all" | "custom";
const PRESETS: { id: Exclude<PresetId, "custom">; label: string; days: number | null }[] = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

type Row = {
  id: MistakeId | "__clean";
  label: string;
  severe: boolean;
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  netR: number;
};

function fmtPct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function fmtR(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

export default function MistakeBreakdown() {
  const { entries, loading } = useBehavioralJournal(500);
  const [preset, setPreset] = useState<PresetId>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { fromMs, toMs, rangeLabel } = useMemo(() => {
    if (preset === "custom" && customRange?.from) {
      const from = startOfDay(customRange.from);
      const to = endOfDay(customRange.to ?? customRange.from);
      const sameDay = from.toDateString() === to.toDateString();
      return {
        fromMs: from.getTime(),
        toMs: to.getTime(),
        rangeLabel: sameDay
          ? format(from, "MMM d, yyyy")
          : `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`,
      };
    }
    if (preset === "all") {
      return { fromMs: -Infinity, toMs: Infinity, rangeLabel: "All time" };
    }
    const def = PRESETS.find((p) => p.id === preset)!;
    const days = def.days ?? 30;
    return {
      fromMs: daysAgo(days - 1).getTime(),
      toMs: endOfDay(new Date()).getTime(),
      rangeLabel: `Last ${days} days`,
    };
  }, [preset, customRange]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= fromMs && t <= toMs;
    });
  }, [entries, fromMs, toMs]);

  const { rows, total, totalClean } = useMemo(() => {
    const seed = new Map<MistakeId | "__clean", Row>();
    for (const m of MISTAKES) {
      seed.set(m.id, {
        id: m.id,
        label: MISTAKE_LABEL[m.id],
        severe: SEVERE_IDS.has(m.id),
        count: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        netR: 0,
      });
    }
    seed.set("__clean", {
      id: "__clean",
      label: "No mistakes (clean)",
      severe: false,
      count: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      netR: 0,
    });

    for (const e of entries) {
      const r = e.result_r;
      const w = r > 0 ? "win" : r < 0 ? "loss" : "be";
      const buckets: Array<MistakeId | "__clean"> =
        e.mistakes.length === 0 ? ["__clean"] : (e.mistakes as MistakeId[]);
      for (const id of buckets) {
        const row = seed.get(id);
        if (!row) continue;
        row.count += 1;
        row.netR += r;
        if (w === "win") row.wins += 1;
        else if (w === "loss") row.losses += 1;
        else row.breakeven += 1;
      }
    }

    const all = Array.from(seed.values()).filter((r) => r.count > 0);
    all.sort((a, b) => {
      if (a.id === "__clean") return 1;
      if (b.id === "__clean") return -1;
      return b.count - a.count;
    });
    const clean = seed.get("__clean")!;
    return { rows: all, total: entries.length, totalClean: clean.count };
  }, [entries]);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-50" />
      <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-8 pb-24">
        <header className="flex items-center justify-between">
          <Link
            to="/hub/journal/history"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70 hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> History
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            Breakdown
          </span>
        </header>

        <h1 className="mt-6 text-[22px] font-semibold tracking-tight text-text-primary">
          Mistake breakdown
        </h1>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          {loading
            ? "Loading…"
            : total === 0
              ? "No trades yet."
              : `${total} trades · ${totalClean} clean`}
        </p>

        {!loading && total > 0 && (
          <div className="mt-6 space-y-2.5">
            {rows.map((r) => {
              const decided = r.wins + r.losses;
              const winRate = decided > 0 ? r.wins / decided : null;
              const tone =
                r.id === "__clean"
                  ? "ring-emerald-500/25 bg-emerald-500/[0.06]"
                  : r.severe
                    ? "ring-rose-500/25 bg-rose-500/[0.05]"
                    : "ring-border bg-card";
              const bar =
                winRate === null
                  ? 0
                  : Math.min(1, Math.max(0, winRate));
              return (
                <div
                  key={r.id}
                  className={`rounded-2xl ring-1 p-3.5 ${tone}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13.5px] font-semibold text-text-primary">
                      {r.label}
                    </p>
                    <p className="text-[11px] tabular-nums text-text-secondary">
                      {r.count} trade{r.count === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-text-primary/10">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${bar * 100}%` }}
                      />
                    </div>
                    <p className="w-12 shrink-0 text-right text-[12px] font-semibold tabular-nums text-text-primary">
                      {winRate === null ? "—" : fmtPct(r.wins, decided)}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-text-secondary tabular-nums">
                    <span>
                      W {r.wins} · L {r.losses} · BE {r.breakeven}
                    </span>
                    <span
                      className={
                        r.netR > 0
                          ? "text-emerald-300"
                          : r.netR < 0
                            ? "text-rose-300"
                            : "text-text-secondary"
                      }
                    >
                      Net {fmtR(r.netR)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && total === 0 && (
          <div className="mt-12 rounded-2xl bg-card ring-1 ring-border p-6 text-center">
            <p className="text-[13.5px] text-text-primary">
              Log a few trades to see your mistake patterns.
            </p>
            <Link
              to="/hub/journal"
              className="mt-4 inline-flex items-center rounded-full bg-primary/15 ring-1 ring-primary/30 px-4 py-2 text-[12px] font-semibold text-text-primary"
            >
              Log a trade
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
