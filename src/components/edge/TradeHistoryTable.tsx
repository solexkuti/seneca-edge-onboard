// Section 2 — TRADE HISTORY (the primary learning engine)
// Answers: "What did I do?"
// Visually dominant table. Click a row to open the trade detail modal.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { TradeRow } from "@/lib/edge/types";
import {
  computePerTradeDiscipline,
  STATE_COLOR,
  toneForRate,
  toneForR,
  type StateTone,
} from "@/lib/edge/metricsEngine";
import { ViolationTag } from "./primitives";

function fmtR(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

function tradeR(t: TradeRow): number {
  if (typeof t.rr === "number" && Number.isFinite(t.rr)) return t.rr;
  if (typeof t.pnl === "number" && typeof t.risk_r === "number" && t.risk_r !== 0) {
    return t.pnl / Math.abs(t.risk_r);
  }
  if (t.result === "win") return 1;
  if (t.result === "loss") return -1;
  return 0;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function disciplineColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 50) return "#FACC15";
  return "#EF4444";
}

export function TradeHistoryTable({
  trades,
  onOpenTrade,
}: {
  trades: TradeRow[];
  onOpenTrade: (t: TradeRow) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const executed = trades.filter((t) => t.trade_type !== "missed");
  const visible = showAll ? executed : executed.slice(0, 10);

  // Header summary
  const closed = executed.filter(
    (t) => t.result === "win" || t.result === "loss" || t.result === "breakeven",
  );
  const wins = closed.filter((t) => t.result === "win").length;
  const decided = closed.filter((t) => t.result !== "breakeven").length;
  const winRate = decided === 0 ? 0 : wins / decided;
  const totalR = closed.reduce((s, t) => s + tradeR(t), 0);
  const avgR = closed.length === 0 ? 0 : totalR / closed.length;

  const wrTone: StateTone = closed.length === 0 ? "neutral" : toneForRate(winRate);
  const totalRTone: StateTone = toneForR(totalR);
  const avgRTone: StateTone = toneForR(avgR);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Trade History
        </h3>
        <span className="text-xs text-[#6B7280]">
          {showAll ? `${executed.length} trades` : "Last 10 trades"}
        </span>
      </div>

      <div className="card-premium overflow-hidden">
        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-[#1F1F23]">
          <SummaryCell label="Total trades" value={`${executed.length}`} />
          <SummaryCell
            label="Win rate"
            value={`${(winRate * 100).toFixed(0)}%`}
            color={STATE_COLOR[wrTone]}
          />
          <SummaryCell
            label="Avg R"
            value={fmtR(avgR)}
            color={STATE_COLOR[avgRTone]}
          />
          <SummaryCell
            label="Total R"
            value={fmtR(totalR)}
            color={STATE_COLOR[totalRTone]}
          />
        </div>

        {/* Table */}
        {executed.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-[#A1A1AA]">No trades logged yet.</p>
            <p className="text-xs text-[#6B7280] mt-1">
              Your trades will appear here the moment you log one.
            </p>
            <Link
              to="/hub/journal"
              className="btn-gold inline-flex items-center mt-4 px-4 py-2 text-xs font-semibold rounded-lg"
            >
              Log a trade
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Asset</th>
                  <th className="text-left font-medium px-4 py-3">Dir</th>
                  <th className="text-left font-medium px-4 py-3">Result</th>
                  <th className="text-left font-medium px-4 py-3">Rules broken</th>
                  <th className="text-left font-medium px-4 py-3">Discipline</th>
                  <th className="text-right font-medium px-4 py-3 pr-5">Notes</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const r = tradeR(t);
                  const rTone =
                    r > 0 ? "#22C55E" : r < 0 ? "#EF4444" : "#A1A1AA";
                  const broken = t.rules_broken ?? [];
                  const disc = computePerTradeDiscipline(t);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onOpenTrade(t)}
                      className="border-t border-[#1F1F23] cursor-pointer hover:bg-[#151518] transition-colors"
                    >
                      <td className="px-4 py-3 text-[#A1A1AA]">
                        {fmtDate(t.executed_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {t.asset ?? "—"}
                      </td>
                      <td className="px-4 py-3 capitalize text-[#A1A1AA]">
                        {t.direction ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3 font-semibold tabular-nums"
                        style={{ color: rTone }}
                      >
                        {fmtR(r)}
                      </td>
                      <td className="px-4 py-3">
                        {broken.length === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#22C55E]/10 text-[#22C55E] ring-1 ring-[#22C55E]/30">
                            Clean
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {broken.slice(0, 3).map((r, i) => (
                              <ViolationTag key={i} label={r} />
                            ))}
                            {broken.length > 3 && (
                              <span className="text-[10px] text-[#6B7280]">
                                +{broken.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 rounded-full bg-[#1F1F23] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${disc}%`,
                                background: disciplineColor(disc),
                              }}
                            />
                          </div>
                          <span
                            className="text-xs font-semibold tabular-nums w-9 text-right"
                            style={{ color: disciplineColor(disc) }}
                          >
                            {disc}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 pr-5 text-right">
                        {t.notes ? (
                          <FileText
                            className="inline h-4 w-4 text-[#A1A1AA]"
                            strokeWidth={1.8}
                          />
                        ) : (
                          <span className="text-[#3F3F46]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {executed.length > 10 && (
          <div className="border-t border-[#1F1F23] px-4 py-3">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-semibold text-[#FF8A1F] hover:text-[#FFB347] transition-colors"
            >
              {showAll ? "Show last 10 only" : `Show all trades (${executed.length}) ↓`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="px-4 py-3 border-r border-[#1F1F23] last:border-r-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
        {label}
      </div>
      <div
        className="text-lg font-extrabold tabular-nums mt-0.5"
        style={{ color: color ?? "#FFFFFF" }}
      >
        {value}
      </div>
    </div>
  );
}

export default TradeHistoryTable;
