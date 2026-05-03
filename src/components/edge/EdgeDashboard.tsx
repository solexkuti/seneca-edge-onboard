// EdgeDashboard — composes the engine output into a single intelligence view.
// Answers: "What is my strategy capable of vs what am I actually doing?"

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useEdgeData } from "@/lib/edge/useEdgeData";
import {
  ActionPanel,
  AppShell,
  BehaviorCard,
  ChartContainer,
  EmptyState,
  InsightCard,
  LoadingSkeleton,
  Modal,
  TimelineList,
  TopMetricsBar,
  TradeCard,
  ViolationTag,
  toneColor,
  type Metric,
  type TimelineItem,
  type Tone,
} from "./primitives";
import { EdgeVsExecutionChart } from "./EdgeVsExecutionChart";
import { PerformanceSnapshot } from "./PerformanceSnapshot";
import { EquityCurveChart } from "./EquityCurveChart";
import { BehaviorBreakdownPanel } from "./BehaviorBreakdownPanel";
import { buildDerivedMetrics } from "@/lib/edge/metricsEngine";
import type { TradeRow } from "@/lib/edge/types";

function fmtR(n: number, sign = true): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${sign && v > 0 ? "+" : ""}${v.toFixed(2)}R`;
}

function toneForRValue(r: number): Tone {
  if (r > 0) return "profit";
  if (r < 0) return "loss";
  return "neutral";
}

function toneForScore(score: number): Tone {
  if (score >= 75) return "profit";
  if (score >= 50) return "warn";
  return "loss";
}

export function EdgeDashboard({ userName }: { userName?: string }) {
  const { status, report, error, trades, refresh } = useEdgeData();
  const [openTrade, setOpenTrade] = useState<TradeRow | null>(null);

  // Pre-compute timeline (newest first): rule violations + missed trades
  const timeline = useMemo<TimelineItem[]>(() => {
    if (!report) return [];
    const items: TimelineItem[] = [];
    for (const t of trades) {
      if (t.trade_type === "missed") {
        items.push({
          id: `missed-${t.id}`,
          at: t.executed_at,
          title: `Missed setup — ${t.asset ?? "—"}`,
          detail: t.missed_potential_r
            ? `Potential ${t.missed_potential_r.toFixed(2)}R left on the table`
            : undefined,
          tone: "warn",
        });
      } else if ((t.rules_broken ?? []).length > 0) {
        items.push({
          id: `viol-${t.id}`,
          at: t.executed_at,
          title: `Rule break — ${t.rules_broken.join(", ").replace(/_/g, " ")}`,
          detail: `${t.asset ?? "—"} · ${fmtR(
            typeof t.rr === "number" ? t.rr : 0,
          )}`,
          tone: t.result === "loss" ? "loss" : "warn",
        });
      }
    }
    return items
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 25);
  }, [trades, report]);

  // Header CTA
  const headerActions = (
    <Link
      to="/hub/journal"
      className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold"
    >
      Log a trade
    </Link>
  );

  if (status === "loading") {
    return (
      <AppShell title={userName ? `Edge · ${userName}` : "Seneca Edge"}>
        <LoadingSkeleton rows={4} />
      </AppShell>
    );
  }

  if (status === "error") {
    return (
      <AppShell title="Seneca Edge">
        <EmptyState
          title="Couldn't load your edge"
          description={error ?? "Try again."}
          action={
            <button
              onClick={() => refresh()}
              className="btn-ghost rounded-lg px-4 py-2 text-sm"
            >
              Retry
            </button>
          }
        />
      </AppShell>
    );
  }

  // No early return for empty data — dashboard always renders with baseline values.

  // Spec: 3 strictly separated layers + the summary gap.
  // A. Actual Performance (executed only)
  // B. System Edge (followed plan)
  // C. Missed Opportunity (never folded into A or B)
  // Gap = (System + Missed) − Actual
  const metrics: Metric[] = [
    {
      label: "System edge",
      value: fmtR(report.systemEdge.totalR),
      hint: `${report.systemEdge.sample} clean trades · ${report.systemEdge.winRate.toFixed(0)}% win`,
      tone: toneForRValue(report.systemEdge.totalR),
    },
    {
      label: "Actual performance",
      value: fmtR(report.actualEdge.totalR),
      hint: `${report.actualEdge.sample} executed · ${report.actualEdge.winRate.toFixed(0)}% win`,
      tone: toneForRValue(report.actualEdge.totalR),
    },
    {
      label: "Missed R",
      value: `${report.missedR >= 0 ? "+" : ""}${report.missedR.toFixed(2)}R`,
      hint:
        report.missedCount > 0
          ? `${report.missedCount} setup${report.missedCount === 1 ? "" : "s"} skipped`
          : "no missed setups logged",
      tone: report.missedR > 0 ? "warn" : "neutral",
    },
    {
      label: "Execution gap",
      value: fmtR(report.executionGapR),
      hint: "(System + Missed) − Actual",
      tone: report.executionGapR > 0 ? "warn" : "neutral",
    },
  ];

  const secondaryMetrics: Metric[] = [
    {
      label: "Discipline",
      value: `${report.disciplineScore}%`,
      hint: `${report.ruleAdherencePct.toFixed(0)}% rule adherence`,
      tone: toneForScore(report.disciplineScore),
    },
  ];

  const recentTrades = trades.slice(0, 8);
  const topViolations = report.violations.slice(0, 5);
  const topPatterns = report.patterns.slice(0, 4);

  return (
    <AppShell
      title={userName ? `Edge · ${userName}` : "Seneca Edge"}
      subtitle="What is my strategy capable of vs what am I actually doing?"
      actions={headerActions}
    >
      <TopMetricsBar metrics={metrics} />

      {/* Baseline state — no trades yet. Dashboard is live, just empty. */}
      {!report.hasData && (
        <div
          className="card-premium p-4 flex items-start gap-3"
          style={{ borderColor: "#FF8A1F33" }}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full mt-1.5"
            style={{ background: "#FF8A1F" }}
          />
          <div className="space-y-1">
            <p className="text-sm text-white">
              Start logging trades to activate your edge tracking. Discipline
              holds at{" "}
              <span
                className="font-extrabold tabular-nums"
                style={{ color: "#22C55E" }}
              >
                100%
              </span>{" "}
              until your first rule break.
            </p>
            <p className="text-xs italic text-[#A1A1AA]">
              Your discipline starts at 100. Protect it.
            </p>
          </div>
        </div>
      )}

      {/* "Left on the table" headline — only when there's something to say */}
      {report.missedR > 0 && (
        <div
          className="card-premium p-4 flex items-center gap-3"
          style={{ borderColor: "#FACC1533" }}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "#FACC15" }}
          />
          <p className="text-sm text-white">
            You left{" "}
            <span
              className="font-extrabold tabular-nums"
              style={{ color: "#FACC15" }}
            >
              {report.missedR.toFixed(2)}R
            </span>{" "}
            on the table across {report.missedCount} missed setup
            {report.missedCount === 1 ? "" : "s"}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryMetrics.map((m, i) => (
          <div key={i} className="card-premium p-5">
            <div className="text-xs uppercase tracking-wider text-[#6B7280]">
              {m.label}
            </div>
            <div
              className="text-2xl font-extrabold tracking-tight mt-1"
              style={{ color: m.tone ? toneColor(m.tone) : "#FFFFFF" }}
            >
              {m.value}
            </div>
            {m.hint && (
              <div className="text-xs text-[#A1A1AA] mt-1">{m.hint}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ChartContainer title="Edge vs Execution">
            <EdgeVsExecutionChart trades={trades} />
          </ChartContainer>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Recent trades</h3>
              <Link
                to="/hub/trades"
                className="text-xs text-[#A1A1AA] hover:text-white"
              >
                View all →
              </Link>
            </div>
            {recentTrades.length === 0 ? (
              <div className="card-premium p-6 text-center">
                <p className="text-sm text-[#A1A1AA]">No trades logged yet</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Your latest trades will appear here as soon as you log one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentTrades.map((t) => (
                  <TradeCard
                    key={t.id}
                    onClick={() => setOpenTrade(t)}
                    trade={{
                      id: t.id,
                      asset: t.asset ?? "—",
                      direction: t.direction,
                      rr:
                        typeof t.rr === "number"
                          ? t.rr
                          : t.trade_type === "missed"
                          ? t.missed_potential_r
                          : null,
                      result: t.result,
                      trade_type: t.trade_type,
                      rules_broken: t.rules_broken ?? [],
                      occurred_at: t.executed_at,
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-white mb-3">
              Behavior by impact
            </h3>
            {topViolations.length === 0 ? (
              <EmptyState
                title="No rule breaks yet"
                description="Clean execution — keep it up."
              />
            ) : (
              <div className="space-y-2">
                {topViolations.map((v) => (
                  <BehaviorCard
                    key={v.type}
                    type={v.type}
                    count={v.count}
                    totalImpactR={v.totalImpactR}
                    lastOccurredAt={v.lastOccurredAt}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-3">
              Patterns detected
            </h3>
            {topPatterns.length === 0 ? (
              <InsightCard
                title="No high-signal patterns yet"
                detail="Log a few more trades — pattern detection sharpens with sample size."
                severity="info"
              />
            ) : (
              <div className="space-y-3">
                {topPatterns.map((p) => (
                  <InsightCard
                    key={p.id}
                    title={p.title}
                    detail={p.detail}
                    severity={p.severity}
                  />
                ))}
              </div>
            )}
          </section>

          {report.sessions.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">
                Best session
              </h3>
              <div className="card-premium p-5">
                <div className="text-xs uppercase tracking-wider text-[#6B7280]">
                  {report.sessions[0].session}
                </div>
                <div
                  className="text-2xl font-extrabold mt-1"
                  style={{
                    color:
                      report.sessions[0].avgR >= 0 ? "#22C55E" : "#EF4444",
                  }}
                >
                  {fmtR(report.sessions[0].avgR)} avg
                </div>
                <div className="text-xs text-[#A1A1AA] mt-1">
                  {report.sessions[0].sample} trades ·{" "}
                  {report.sessions[0].winRate.toFixed(0)}% win
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <ChartContainer title="Behavior timeline">
        <TimelineList items={timeline} />
      </ChartContainer>

      <ActionPanel
        title="Close the gap"
        description="The most direct way to recover R is to fix your top-impact rule break."
        actions={
          <>
            <Link
              to="/hub/journal"
              className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Log next trade
            </Link>
            <Link
              to="/hub/strategy"
              className="btn-ghost rounded-lg px-4 py-2 text-sm"
            >
              Review strategy
            </Link>
          </>
        }
      />

      <Modal
        open={!!openTrade}
        onClose={() => setOpenTrade(null)}
        title={openTrade ? `${openTrade.asset ?? "Trade"} · ${new Date(openTrade.executed_at).toLocaleString()}` : "Trade"}
      >
        {openTrade && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Direction" value={openTrade.direction ?? "—"} />
              <Field label="Result" value={openTrade.result ?? "—"} />
              <Field
                label="R"
                value={
                  typeof openTrade.rr === "number"
                    ? fmtR(openTrade.rr)
                    : "—"
                }
              />
              <Field label="Entry" value={openTrade.entry_price?.toString() ?? "—"} />
              <Field label="Exit" value={openTrade.exit_price?.toString() ?? "—"} />
              <Field label="Session" value={openTrade.session ?? "—"} />
            </div>
            {(openTrade.rules_broken ?? []).length > 0 && (
              <div>
                <div className="text-xs text-[#6B7280] uppercase mb-2">
                  Rules broken
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {openTrade.rules_broken.map((r, i) => (
                    <ViolationTag key={i} label={r} />
                  ))}
                </div>
              </div>
            )}
            {openTrade.notes && (
              <div>
                <div className="text-xs text-[#6B7280] uppercase mb-2">Notes</div>
                <p className="text-[#A1A1AA] leading-relaxed">{openTrade.notes}</p>
              </div>
            )}
            {openTrade.screenshot_url && (
              <img
                src={openTrade.screenshot_url}
                alt="Trade screenshot"
                className="w-full rounded-lg border border-[#1F1F23]"
              />
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
        {label}
      </div>
      <div className="text-sm font-semibold text-white mt-0.5 capitalize">
        {value}
      </div>
    </div>
  );
}

export default EdgeDashboard;
