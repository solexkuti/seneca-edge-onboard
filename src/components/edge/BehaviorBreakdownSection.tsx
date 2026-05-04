// Section 3 — BEHAVIOR BREAKDOWN (diagnosis)
// Answers: "What is killing me?"
// Score + adherence + ranked rule violations by R impact.

import type { BehaviorMetrics } from "@/lib/edge/metricsEngine";
import { STATE_COLOR, toneForScore } from "@/lib/edge/metricsEngine";

function fmtR(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function prettyRule(rule: string): string {
  return rule
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BehaviorBreakdownSection({
  metrics,
}: {
  metrics: BehaviorMetrics;
}) {
  const discTone = toneForScore(metrics.discipline_score);
  const adhPct = metrics.rule_adherence * 100;
  const adhTone = toneForScore(adhPct);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Behavior Breakdown
        </h3>
        <span className="text-xs text-[#6B7280]">
          {metrics.total_violations} violation
          {metrics.total_violations === 1 ? "" : "s"}
        </span>
      </div>

      <div className="card-premium overflow-hidden">
        {/* Score row */}
        <div className="grid grid-cols-2 border-b border-[#1F1F23]">
          <div className="px-5 py-4 border-r border-[#1F1F23]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
              Behavior score
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: STATE_COLOR[discTone] }}
              >
                {metrics.discipline_score}
              </span>
              <span className="text-sm text-[#6B7280]">/ 100</span>
            </div>
            <div className="text-xs text-[#A1A1AA] mt-1">
              Avg per-trade discipline (last 20)
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                Rule adherence
              </div>
              <span
                className="text-lg font-extrabold tabular-nums"
                style={{ color: STATE_COLOR[adhTone] }}
              >
                {adhPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1F1F23] overflow-hidden mt-3">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${adhPct}%`,
                  background: STATE_COLOR[adhTone],
                }}
              />
            </div>
            <div className="text-xs text-[#A1A1AA] mt-2">
              Trades executed without breaking rules
            </div>
          </div>
        </div>

        {/* Violations table */}
        {metrics.violations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-white">No rule breaks yet.</p>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Clean execution — keep it up.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                  <th className="text-left font-medium px-5 py-3">Rule</th>
                  <th className="text-right font-medium px-4 py-3">Times</th>
                  <th className="text-right font-medium px-4 py-3">Last broken</th>
                  <th className="text-right font-medium px-5 py-3">Impact</th>
                </tr>
              </thead>
              <tbody>
                {metrics.violations.map((v) => {
                  const impactColor =
                    v.impact_R < 0
                      ? "#EF4444"
                      : v.impact_R > 0
                        ? "#22C55E"
                        : "#A1A1AA";
                  return (
                    <tr
                      key={v.rule}
                      className="border-t border-[#1F1F23]"
                    >
                      <td className="px-5 py-3 font-semibold text-white">
                        {prettyRule(v.rule)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#A1A1AA]">
                        {v.count}
                      </td>
                      <td className="px-4 py-3 text-right text-[#A1A1AA]">
                        {fmtDate(v.last_occurred_at)}
                      </td>
                      <td
                        className="px-5 py-3 text-right font-semibold tabular-nums"
                        style={{ color: impactColor }}
                      >
                        {fmtR(v.impact_R)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default BehaviorBreakdownSection;
