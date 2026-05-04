// Section 4 — PERFORMANCE TREND (supporting visual)
// Cumulative R over time. Clean, simple, no overlays.

import type { TrendData } from "@/lib/edge/metricsEngine";
import { EquityCurveChart } from "./EquityCurveChart";

export function PerformanceTrendSection({ trend }: { trend: TrendData }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Performance Trend
        </h3>
        <span className="text-xs text-[#6B7280]">Cumulative R</span>
      </div>
      <div className="card-premium p-5">
        <EquityCurveChart points={trend.equity_curve} />
      </div>
    </section>
  );
}

export default PerformanceTrendSection;
