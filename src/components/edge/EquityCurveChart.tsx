// EquityCurveChart — Performance Trend, fed by trend_data.equity_curve.
// Always renders. With 0 trades, draws a flat line at 0R.

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { EquityPoint } from "@/lib/edge/metricsEngine";

export function EquityCurveChart({ points }: { points: EquityPoint[] }) {
  // Ensure at least 2 points so the chart doesn't collapse
  const data =
    points.length >= 2
      ? points
      : [
          { t: Date.now() - 60_000, label: "", total_R: 0 },
          { t: Date.now(), label: "", total_R: points[0]?.total_R ?? 0 },
        ];

  const last = data[data.length - 1].total_R;
  const stroke = last > 0 ? "#22C55E" : last < 0 ? "#EF4444" : "#A1A1AA";

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            stroke="#1F1F23"
            tick={{ fill: "#A1A1AA", fontSize: 11 }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            stroke="#1F1F23"
            tick={{ fill: "#A1A1AA", fontSize: 11 }}
            tickLine={false}
            width={44}
            tickFormatter={(v) => `${v}R`}
          />
          <ReferenceLine y={0} stroke="#1F1F23" />
          <Tooltip
            contentStyle={{
              background: "#111114",
              border: "1px solid #1F1F23",
              borderRadius: 10,
              color: "#FFFFFF",
              fontSize: 12,
            }}
            labelStyle={{ color: "#A1A1AA" }}
            formatter={(value: number) => [`${value.toFixed(2)}R`, "Cumulative R"]}
          />
          <Area
            type="monotone"
            dataKey="total_R"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#equityFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EquityCurveChart;
