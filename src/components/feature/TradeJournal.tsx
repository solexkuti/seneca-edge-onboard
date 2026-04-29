// Trade Journal — list of trade_logs with full structured data.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { fetchTradeLogs, fmtR, type TradeLog } from "@/lib/tradeLogs";

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

export default function TradeJournal() {
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);

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

  const empty = !loading && trades.length === 0;

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
              {loading ? "Loading…" : `${trades.length} entries`}
            </p>
          </div>
          <Link
            to="/hub/journal"
            className="rounded-full bg-primary/15 ring-1 ring-primary/30 px-3.5 py-2 text-[11.5px] font-semibold text-text-primary"
          >
            Log trade
          </Link>
        </div>

        {empty && (
          <div className="mt-12 rounded-2xl bg-card ring-1 ring-border p-6 text-center">
            <p className="text-[13.5px] text-text-primary">
              Log your first trade to activate performance tracking.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {trades.map((t) => {
            const time = fmt(t.opened_at);
            const r = t.rr;
            const tone =
              t.outcome === "win"
                ? "text-emerald-300"
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
                    {fmtR(r)}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] text-text-secondary tabular-nums">
                  <Cell k="Entry" v={t.entry_price} />
                  <Cell k="Exit" v={t.exit_price} />
                  <Cell k="SL" v={t.stop_loss} />
                  <Cell k="TP" v={t.take_profit} />
                </div>

                {(t.mistakes.length > 0 || !t.rules_followed) && (
                  <p className="mt-2 text-[11.5px] text-amber-300/85">
                    {t.mistakes.length > 0
                      ? t.mistakes.join(" · ")
                      : "Rules broken"}
                  </p>
                )}

                {t.note && (
                  <p className="mt-2 text-[12px] italic text-text-secondary/85">
                    "{t.note}"
                  </p>
                )}

                {t.screenshot_url && (
                  <a
                    href={t.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-[11px] text-text-secondary/70 underline"
                  >
                    View screenshot
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
