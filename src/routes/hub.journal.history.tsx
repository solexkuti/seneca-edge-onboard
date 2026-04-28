import { createFileRoute, Link, useNavigate, ErrorComponent, useRouter } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Filter, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { fetchJournal, type DbJournalRow, type EmotionalState } from "@/lib/dbJournal";
import JournalExportButton from "@/components/feature/JournalExportButton";
import JournalSyncStatus from "@/components/feature/JournalSyncStatus";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";
import { playFeedback } from "@/lib/feedback";
import RequireAuth from "@/components/auth/RequireAuth";

const EMOTIONAL_STATES = ["all", "calm", "fearful", "frustrated", "overconfident", "confused"] as const;
const SORTS = ["recent", "oldest", "discipline_high", "discipline_low"] as const;

const searchSchema = z.object({
  market: fallback(z.string(), "").default(""),
  state: fallback(z.enum(EMOTIONAL_STATES), "all").default("all"),
  minScore: fallback(z.number().min(0).max(100), 0).default(0),
  maxScore: fallback(z.number().min(0).max(100), 100).default(100),
  sort: fallback(z.enum(SORTS), "recent").default("recent"),
});

export const Route = createFileRoute("/hub/journal/history")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Journal History — SenecaEdge" },
      { name: "description", content: "Filter and review your trading journal by market, emotional state, and discipline." },
    ],
  }),
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-sm">
        <p className="text-destructive">Couldn't load history: {error.message}</p>
        <button onClick={() => router.invalidate()} className="mt-3 underline">Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: () => (
    <RequireAuth>
      <HistoryPage />
    </RequireAuth>
  ),
});

function HistoryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/hub/journal/history" });
  const [rows, setRows] = useState<DbJournalRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchJournal();
      if (!cancelled) setRows(data);
    };
    load();
    const onUpdate = () => load();
    window.addEventListener(JOURNAL_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(JOURNAL_EVENT, onUpdate);
    };
  }, []);

  const markets = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => r.pair && set.add(r.pair));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let out = rows.filter((r) => {
      if (search.market && r.pair !== search.market) return false;
      if (search.state !== "all" && r.emotional_state !== search.state) return false;
      if (r.discipline_score < search.minScore) return false;
      if (r.discipline_score > search.maxScore) return false;
      return true;
    });
    switch (search.sort) {
      case "oldest":
        out = [...out].sort((a, b) => a.timestamp - b.timestamp);
        break;
      case "discipline_high":
        out = [...out].sort((a, b) => b.discipline_score - a.discipline_score);
        break;
      case "discipline_low":
        out = [...out].sort((a, b) => a.discipline_score - b.discipline_score);
        break;
      default:
        out = [...out].sort((a, b) => b.timestamp - a.timestamp);
    }
    return out;
  }, [rows, search]);

  const update = (patch: Partial<typeof search>) => {
    playFeedback("tap");
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }) });
  };

  const reset = () => {
    playFeedback("back");
    navigate({ search: { market: "", state: "all", minScore: 0, maxScore: 100, sort: "recent" } as any });
  };

  const activeFilters =
    (search.market ? 1 : 0) +
    (search.state !== "all" ? 1 : 0) +
    (search.minScore > 0 || search.maxScore < 100 ? 1 : 0);

  return (
    <div className="relative min-h-[100svh] w-full bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-80" />
      <div className="relative z-10 mx-auto w-full max-w-[520px] px-5 pt-6 pb-16">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/hub/journal"
            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border shadow-soft"
            aria-label="Back to Journal"
          >
            <ArrowLeft className="h-4 w-4 text-text-primary transition-transform group-hover:-translate-x-0.5" strokeWidth={2.2} />
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80">
            History
          </span>
          <div className="flex items-center gap-2">
            <JournalSyncStatus />
            <JournalExportButton />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5"
        >
          <h1 className="text-[24px] font-bold tracking-tight text-text-primary">Journal history</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {rows === null ? "Loading…" : `${filtered.length} of ${rows.length} entries`}
          </p>
        </motion.div>

        {/* Filters */}
        <div className="mt-5 rounded-2xl bg-card ring-1 ring-border shadow-soft p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilters > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                  {activeFilters}
                </span>
              )}
            </div>
            {activeFilters > 0 && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          {/* Market */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">Market</label>
            <select
              value={search.market}
              onChange={(e) => update({ market: e.target.value })}
              className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-primary/50"
            >
              <option value="">All markets</option>
              {markets.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Emotional state */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">Emotional state</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONAL_STATES.map((s) => {
                const active = search.state === s;
                return (
                  <button
                    key={s}
                    onClick={() => update({ state: s })}
                    className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
                      active
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "bg-background ring-1 ring-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discipline score range */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-medium text-text-secondary">Discipline score</label>
              <span className="text-[11px] tabular-nums text-text-primary">
                {search.minScore}–{search.maxScore}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-text-secondary">Min</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={25}
                  value={search.minScore}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    update({ minScore: v, maxScore: Math.max(v, search.maxScore) });
                  }}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <span className="text-[10px] text-text-secondary">Max</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={25}
                  value={search.maxScore}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    update({ maxScore: v, minScore: Math.min(v, search.minScore) });
                  }}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">Sort by</label>
            <select
              value={search.sort}
              onChange={(e) => update({ sort: e.target.value as typeof search.sort })}
              className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-primary/50"
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="discipline_high">Discipline: high → low</option>
              <option value="discipline_low">Discipline: low → high</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Results
          </span>
          {filtered.length > 0 && (
            <JournalExportButton
              rows={filtered}
              label="filtered"
              triggerLabel={`Export ${filtered.length}`}
            />
          )}
        </div>
        <div className="mt-3 space-y-5">
          {rows === null && (
            <div className="rounded-2xl bg-card ring-1 ring-border p-6 text-center text-sm text-text-secondary">
              Loading entries…
            </div>
          )}
          {rows !== null && filtered.length === 0 && (
            <div className="rounded-2xl bg-card ring-1 ring-border p-6 text-center text-sm text-text-secondary">
              No entries match these filters.
            </div>
          )}
          {groupByDay(filtered).map((group) => (
            <section key={group.key} className="space-y-2.5">
              <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
                {group.label}
                <span className="ml-2 text-text-secondary/60">{group.rows.length}</span>
              </h2>
              {group.rows.map((r) => (
                <EntryCard key={r.id} row={r} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function EntryCard({ row }: { row: DbJournalRow }) {
  const date = new Date(row.timestamp);
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isLong = row.direction === "long";
  const score = row.discipline_score;
  const scoreColor =
    score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl bg-card ring-1 ring-border shadow-soft p-4"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">{row.pair}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isLong ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"
              }`}
            >
              {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {row.direction}
            </span>
            {row.result && (
              <span className="text-[10px] uppercase tracking-wider text-text-secondary">
                {row.result}
                {row.rr ? ` · ${row.rr}R` : ""}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">
            {dateLabel} · <span className="capitalize">{row.emotional_state}</span>
          </div>
        </div>
        <div className={`text-right tabular-nums ${scoreColor}`}>
          <div className="text-lg font-bold leading-none">{score}</div>
          <div className="text-[9px] uppercase tracking-wider text-text-secondary">discipline</div>
        </div>
      </div>
      {row.notes && (
        <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{row.notes}</p>
      )}
    </motion.div>
  );
}

type DayGroup = { key: string; label: string; rows: DbJournalRow[] };

// Resolve the user's IANA timezone (e.g. "Europe/Madrid"). Falls back to UTC
// in environments where Intl is unavailable.
function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Returns a stable YYYY-MM-DD key for a timestamp as observed in `tz`.
// Using Intl avoids DST drift bugs you get from local-Date arithmetic.
function dayKeyInTz(ts: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ts));
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function groupByDay(rows: DbJournalRow[]): DayGroup[] {
  const tz = getUserTimeZone();
  const groups = new Map<string, DayGroup>();
  const now = Date.now();
  const todayKey = dayKeyInTz(now, tz);
  const yesterdayKey = dayKeyInTz(now - 86_400_000, tz);
  const currentYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
  }).format(new Date(now));

  for (const r of rows) {
    const key = dayKeyInTz(r.timestamp, tz);
    let label: string;
    if (key === todayKey) label = "Today";
    else if (key === yesterdayKey) label = "Yesterday";
    else {
      const rowYear = key.slice(0, 4);
      label = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: rowYear !== currentYear ? "numeric" : undefined,
      }).format(new Date(r.timestamp));
    }
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  // Sort groups by recency (YYYY-MM-DD strings sort chronologically).
  return Array.from(groups.values()).sort((a, b) =>
    a.key < b.key ? 1 : a.key > b.key ? -1 : 0,
  );
}
