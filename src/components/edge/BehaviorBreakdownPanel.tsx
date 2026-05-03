// BehaviorBreakdownPanel — Layer 3 binding for behavior_metrics.
// Renders discipline_score, rule_adherence, and grouped violations.
// Always renders, even with zero violations.

import type { BehaviorMetrics } from "@/lib/edge/metricsEngine";
import { STATE_COLOR, toneForScore } from "@/lib/edge/metricsEngine";
import { BehaviorCard, EmptyState } from "./primitives";

export function BehaviorBreakdownPanel({ metrics }: { metrics: BehaviorMetrics }) {
  const discTone = toneForScore(metrics.discipline_score);
  const adhPct = metrics.rule_adherence * 100;
  const adhTone = toneForScore(adhPct);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Behavior breakdown</h3>
        <span className="text-xs text-[#6B7280]">
          {metrics.total_violations} violation
          {metrics.total_violations === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card-premium p-4">
          <div className="text-xs uppercase tracking-wider text-[#6B7280]">
            Discipline
          </div>
          <div
            className="text-2xl font-extrabold tabular-nums mt-1"
            style={{ color: STATE_COLOR[discTone] }}
          >
            {metrics.discipline_score}%
          </div>
          <div className="text-xs text-[#A1A1AA] mt-1">Recent + lifetime blend</div>
        </div>
        <div className="card-premium p-4">
          <div className="text-xs uppercase tracking-wider text-[#6B7280]">
            Rule adherence
          </div>
          <div
            className="text-2xl font-extrabold tabular-nums mt-1"
            style={{ color: STATE_COLOR[adhTone] }}
          >
            {adhPct.toFixed(0)}%
          </div>
          <div className="text-xs text-[#A1A1AA] mt-1">Trades with no breaks</div>
        </div>
      </div>

      {metrics.violations.length === 0 ? (
        <EmptyState
          title="No rule breaks yet"
          description="Clean execution — keep it up."
        />
      ) : (
        <div className="space-y-2">
          {metrics.violations.slice(0, 6).map((v) => (
            <BehaviorCard
              key={v.rule}
              type={v.rule}
              count={v.count}
              totalImpactR={v.impact_R}
              lastOccurredAt={v.last_occurred_at}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default BehaviorBreakdownPanel;
