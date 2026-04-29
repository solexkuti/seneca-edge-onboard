// Trade Journal — list of trade_logs with filters and full structured data.
// Persistence: trades come from public.trade_logs (written by the journal
// flow). This screen reads, filters, and displays them. No placeholders —
// when there's nothing to show, render the empty-state copy.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search, X } from "lucide-react";
import {
  fetchTradeLogs,
  fmtR,
  type Outcome,
  type TradeLog,
} from "@/lib/tradeLogs";
import {
  MISTAKE_PENALTY,
  PER_TRADE_BASE,
  MAX_PENALTY,
  MIN_TRADE_SCORE,
} from "@/lib/behavioralJournal";

type ScoreBreakdown = {
  items: { id: string; label: string; penalty: number }[];
  rawPenalty: number;
  appliedPenalty: number;
  cappedAt: number; // amount trimmed by the cap (rawPenalty - appliedPenalty)
  score: number;
  base: number;
};

function computeBreakdown(mistakes: string[]): ScoreBreakdown {
  const items = mistakes.map((id) => ({
    id,
    label: prettyMistake(id),
    penalty: MISTAKE_PENALTY[id as keyof typeof MISTAKE_PENALTY] ?? 0,
  }));
  const rawPenalty = items.reduce((s, b) => s + b.penalty, 0);
  const appliedPenalty = Math.min(MAX_PENALTY, rawPenalty);
  const score = Math.max(MIN_TRADE_SCORE, PER_TRADE_BASE - appliedPenalty);
  return {
    items,
    rawPenalty,
    appliedPenalty,
    cappedAt: rawPenalty - appliedPenalty,
    score,
    base: PER_TRADE_BASE,
  };
}

type OutcomeFilter = "all" | Outcome;
type MarketFilter = "all" | string;
type MistakeFilter = "all" | "mistakes_only";

function fmt(iso: string): { local: string; utc: string } {
  const d = new Date(iso);
  return {
    local: d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    utc: d.toISOString().slice(0, 16).replace("T", " ") + "Z",
  };
}

// Format raw mistake ids ("moved_sl") into human labels ("Moved Stop Loss").
const MISTAKE_DISPLAY: Record<string, string> = {
  overleveraged: "Overleveraged",
  revenge_trade: "Revenge Trade",
  no_setup: "Entered Without Setup",
  ignored_sl: "Ignored Stop Loss",
  early_entry: "Early Entry",
  late_entry: "Late Entry",
  moved_sl: "Moved Stop Loss",
  oversized: "Oversized Position",
  fomo: "FOMO Entry",
  broke_risk_rule: "Broke Risk Rule",
};

function prettyMistake(raw: string): string {
  if (MISTAKE_DISPLAY[raw]) return MISTAKE_DISPLAY[raw];
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const OUTCOME_PILLS: { id: OutcomeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "win", label: "Wins" },
  { id: "loss", label: "Losses" },
  { id: "breakeven", label: "BE" },
];

export default function TradeJournal() {
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [market, setMarket] = useState<MarketFilter>("all");
  const [mistakeFilter, setMistakeFilter] = useState<MistakeFilter>("all");
  const [query, setQuery] = useState("");

  const filtersActive =
    outcome !== "all" ||
    market !== "all" ||
    mistakeFilter !== "all" ||
    query.trim().length > 0;

  function clearFilters() {
    setOutcome("all");
    setMarket("all");
    setMistakeFilter("all");
    setQuery("");
  }

  useEffect(() => {
    let c = false;
    fetchTradeLogs({ limit: 200 })
      .then((t) => {
        if (!c) setTrades(t);
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, []);

  const markets = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) if (t.market) s.add(t.market);
    return Array.from(s).sort();
  }, [trades]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trades.filter((t) => {
      // Group A: Result
      if (outcome !== "all" && t.outcome !== outcome) return false;
      // Group B: Market
      if (market !== "all" && t.market !== market) return false;
      // Group C: Mistakes
      if (mistakeFilter === "mistakes_only" && t.mistakes.length === 0 && t.rules_followed) {
        return false;
      }
      if (q) {
        const hay = [
          t.pair,
          t.market,
          t.note ?? "",
          ...(t.mistakes ?? []).map(prettyMistake),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trades, outcome, market, mistakeFilter, query]);

  const empty = !loading && trades.length === 0;
  const noMatch = !loading && trades.length > 0 && filtered.length === 0;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-50" />
      <div className="relative z-10 mx-auto w-full max-w-[520px] px-5 pt-8 pb-24">
        <header className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70 hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            Trade journal
          </span>
        </header>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">
              All trades
            </h1>
            <p className="mt-1 text-[12.5px] text-text-secondary">
              {loading
                ? "Loading…"
                : `${filtered.length} of ${trades.length} entries`}
            </p>
          </div>
          <Link
            to="/hub/journal"
            className="rounded-full bg-primary/15 ring-1 ring-primary/30 px-3.5 py-2 text-[11.5px] font-semibold text-text-primary"
          >
            Log trade
          </Link>
        </div>

        {/* Filters */}
        {!empty && (
          <div className="mt-5 space-y-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary/55" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pair, mistake, note…"
                className="w-full rounded-full bg-card ring-1 ring-border px-9 py-2 text-[12.5px] text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-primary/40"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-secondary/70 hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Group A — Result */}
            <FilterGroup label="Result">
              {OUTCOME_PILLS.map((p) => (
                <Pill
                  key={p.id}
                  active={outcome === p.id}
                  onClick={() => setOutcome(p.id)}
                >
                  {p.label}
                </Pill>
              ))}
            </FilterGroup>

            {/* Group B — Market */}
            <FilterGroup label="Market">
              <Pill active={market === "all"} onClick={() => setMarket("all")}>
                All markets
              </Pill>
              {markets.map((m) => (
                <Pill
                  key={m}
                  active={market === m}
                  onClick={() => setMarket(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Pill>
              ))}
            </FilterGroup>

            {/* Group C — Mistakes */}
            <FilterGroup label="Mistakes">
              <Pill
                active={mistakeFilter === "all"}
                onClick={() => setMistakeFilter("all")}
              >
                All
              </Pill>
              <Pill
                active={mistakeFilter === "mistakes_only"}
                onClick={() => setMistakeFilter("mistakes_only")}
              >
                Mistakes only
              </Pill>
            </FilterGroup>

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-semibold text-text-secondary hover:text-text-primary underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {empty && (
          <div className="mt-12 rounded-2xl bg-card ring-1 ring-border p-6 text-center">
            <p className="text-[13.5px] text-text-primary">
              Log your first trade to activate performance tracking.
            </p>
            <Link
              to="/hub/journal"
              className="mt-4 inline-flex items-center rounded-full bg-primary/15 ring-1 ring-primary/30 px-4 py-2 text-[12px] font-semibold text-text-primary"
            >
              Log a trade
            </Link>
          </div>
        )}

        {noMatch && (
          <div className="mt-10 rounded-2xl bg-card/60 ring-1 ring-border/60 p-5 text-center">
            <p className="text-[12.5px] text-text-secondary">
              No trades match these filters.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-[11.5px] font-semibold text-text-primary underline underline-offset-2"
            >
              Reset filters
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {filtered.map((t) => {
            const time = fmt(t.opened_at);
            const tone =
              t.outcome === "win"
                ? "text-gold"
                : t.outcome === "loss"
                  ? "text-rose-300"
                  : "text-amber-300";
            return (
              <div
                key={t.id}
                className="rounded-2xl bg-card ring-1 ring-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-text-primary">
                        {t.pair}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary/60">
                        {t.market} · {t.direction}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-text-secondary/70 tabular-nums">
                      {time.local}
                      <span className="mx-1.5 text-text-secondary/40">•</span>
                      {time.utc}
                      {t.timezone ? (
                        <span className="ml-1.5 text-text-secondary/55">
                          ({t.timezone})
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className={`text-[14px] font-semibold tabular-nums ${tone}`}>
                    {fmtR(t.rr)}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] text-text-secondary tabular-nums">
                  <Cell k="Entry" v={t.entry_price} />
                  <Cell k="Actual Exit" v={t.exit_price} />
                  <Cell k="SL" v={t.stop_loss} />
                  <Cell k="TP" v={t.take_profit} />
                </div>

                {(t.mistakes.length > 0 || !t.rules_followed) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.mistakes.length > 0 ? (
                      t.mistakes.map((m) => (
                        <span
                          key={m}
                          className="rounded-full bg-amber-400/10 ring-1 ring-amber-400/30 px-2 py-0.5 text-[10.5px] font-medium text-amber-300"
                        >
                          {prettyMistake(m)}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-amber-400/10 ring-1 ring-amber-400/30 px-2 py-0.5 text-[10.5px] font-medium text-amber-300">
                        Rules broken
                      </span>
                    )}
                  </div>
                )}

                {(() => {
                  const bd = computeBreakdown(t.mistakes ?? []);
                  const scoreTone =
                    bd.score >= 80
                      ? "text-gold"
                      : bd.score >= 50
                        ? "text-amber-300"
                        : "text-rose-300";
                  return (
                    <div className="mt-3 rounded-xl bg-background/40 ring-1 ring-border/70 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary/70">
                          Why this score
                        </span>
                        <span className={`text-[12px] font-semibold tabular-nums ${scoreTone}`}>
                          {bd.score} / {bd.base}
                        </span>
                      </div>

                      {bd.items.length === 0 ? (
                        <p className="mt-1.5 text-[11px] leading-snug text-text-secondary/80">
                          Clean execution — no penalties. Started at{" "}
                          <span className="tabular-nums">{bd.base}</span>, no
                          mistakes flagged.
                        </p>
                      ) : (
                        <>
                          <ul className="mt-1.5 space-y-1">
                            {bd.items.map((b) => (
                              <li
                                key={b.id}
                                className="flex items-center justify-between text-[11px] text-text-secondary/90"
                              >
                                <span className="truncate pr-2">{b.label}</span>
                                <span className="tabular-nums text-rose-300/90">
                                  −{b.penalty}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-1.5 text-[10.5px] text-text-secondary/70">
                            <span>
                              Base {bd.base}
                              {bd.cappedAt > 0 ? (
                                <span className="ml-1.5 text-text-secondary/55">
                                  · cap −{MAX_PENALTY} (trimmed −{bd.cappedAt})
                                </span>
                              ) : null}
                            </span>
                            <span className="tabular-nums">
                              −{bd.appliedPenalty} applied
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {t.note && (
                  <p className="mt-2.5 text-[12px] italic leading-snug text-text-secondary/85">
                    "{t.note}"
                  </p>
                )}

                {t.screenshot_url && (
                  <a
                    href={t.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open trade screenshot"
                    className="mt-3 block overflow-hidden rounded-lg ring-1 ring-border bg-card transition hover:ring-primary/40"
                  >
                    <img
                      src={t.screenshot_url}
                      alt={`${t.pair} trade screenshot`}
                      loading="lazy"
                      className="h-28 w-full object-cover"
                    />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
        {label}
      </p>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition ${
        active
          ? "bg-primary/20 ring-primary/40 text-text-primary"
          : "bg-card ring-border text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Cell({ k, v }: { k: string; v: number | null }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-text-secondary/55">
        {k}
      </p>
      <p className="text-[12px] font-semibold text-text-primary tabular-nums">
        {v ?? "—"}
      </p>
    </div>
  );
}
