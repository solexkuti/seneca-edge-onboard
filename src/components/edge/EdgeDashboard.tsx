// EdgeDashboard — TRADING COACH layout (restored from old version).
//
// Strict hierarchy, top → down:
//   1. Core Performance Metrics  → "Am I profitable?"
//   2. Trade History             → "What did I do?"
//   3. Behavior Breakdown        → "What is killing me?"
//   4. Performance Trend         → supporting visual
//
// Everything else (System edge, Execution gap, Edge-vs-Execution chart,
// Patterns sidebar, Best session, Behavior timeline, Missed-R headline)
// is intentionally NOT on the dashboard. The Edge Alert remains only as
// the existing subtle floating pill.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useEdgeData } from "@/lib/edge/useEdgeData";
import { buildDerivedMetrics } from "@/lib/edge/metricsEngine";
import { useMemo } from "react";
import {
  AppShell,
  EmptyState,
  LoadingSkeleton,
  Modal,
  ViolationTag,
} from "./primitives";
import { CoreMetricsStrip } from "./CoreMetricsStrip";
import { TradeHistoryTable } from "./TradeHistoryTable";
import { BehaviorBreakdownSection } from "./BehaviorBreakdownSection";
import { PerformanceTrendSection } from "./PerformanceTrendSection";
import type { TradeRow } from "@/lib/edge/types";

function fmtR(n: number, sign = true): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${sign && v > 0 ? "+" : ""}${v.toFixed(2)}R`;
}

export function EdgeDashboard({ userName }: { userName?: string }) {
  const { status, error, trades, violations, refresh } = useEdgeData();
  const [openTrade, setOpenTrade] = useState<TradeRow | null>(null);

  const derived = useMemo(
    () => buildDerivedMetrics(trades, violations),
    [trades, violations],
  );

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
      <AppShell title={userName ? `Welcome back, ${userName}.` : "Welcome back."}>
        <LoadingSkeleton rows={4} />
      </AppShell>
    );
  }

  if (status === "error") {
    return (
      <AppShell title="Welcome back.">
        <EmptyState
          title="Couldn't load your dashboard"
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

  return (
    <AppShell
      title={userName ? `Welcome back, ${userName}.` : "Welcome back."}
      subtitle="Outcome → actions → behavior. Your edge in one glance."
      actions={headerActions}
    >
      {/* 1. CORE PERFORMANCE METRICS — "Am I profitable?" */}
      <CoreMetricsStrip
        metrics={derived.performance_metrics}
        hasData={derived.has_data}
      />

      {/* 2. TRADE HISTORY — "What did I do?" (visually dominant) */}
      <TradeHistoryTable trades={trades} onOpenTrade={setOpenTrade} />

      {/* 3. BEHAVIOR BREAKDOWN — "What is killing me?" */}
      <BehaviorBreakdownSection metrics={derived.behavior_metrics} />

      {/* 4. PERFORMANCE TREND — supporting visual */}
      <PerformanceTrendSection trend={derived.trend_data} />

      {/* Trade detail modal */}
      <Modal
        open={!!openTrade}
        onClose={() => setOpenTrade(null)}
        title={
          openTrade
            ? `${openTrade.asset ?? "Trade"} · ${new Date(openTrade.executed_at).toLocaleString()}`
            : "Trade"
        }
      >
        {openTrade && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Direction" value={openTrade.direction ?? "—"} />
              <Field label="Result" value={openTrade.result ?? "—"} />
              <Field
                label="R"
                value={
                  typeof openTrade.rr === "number" ? fmtR(openTrade.rr) : "—"
                }
              />
              <Field
                label="Entry"
                value={openTrade.entry_price?.toString() ?? "—"}
              />
              <Field
                label="Exit"
                value={openTrade.exit_price?.toString() ?? "—"}
              />
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
                <p className="text-[#A1A1AA] leading-relaxed">
                  {openTrade.notes}
                </p>
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
