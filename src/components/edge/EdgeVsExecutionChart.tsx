// EdgeVsExecutionChart — cumulative system R (clean trades only) vs
// cumulative actual R (all executed trades), in chronological order.
// The shaded area between them is the "execution gap".

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeRow } from "@/lib/edge/types";
import { isExecuted, isSystemTrade } from "@/lib/edge/types";

type Point = {
  t: number;
  label: string;
  system: number;
  actual: number;
};

function tradeR(t: TradeRow): number {
  if (typeof t.rr === "number" && Number.isFinite(t.rr)) return t.rr;
  if (
    typeof t.pnl === "number" &&
    typeof t.risk_r === "number" &&
    t.risk_r !== 0
  ) {
    return t.pnl / Math.abs(t.risk_r);
  }
  if (t.result === "win") return 1;
  if (t.result === "loss") return -1;
  return 0;
}

export function EdgeVsExecutionChart({ trades }: { trades: TradeRow[] }) {
  const sorted = [...trades]
    .filter(isExecuted)
    .filter((t) => t.result === "win" || t.result === "loss")
    .sort((a, b) => (a.executed_at < b.executed_at ? -1 : 1));

  let sysCum = 0;
  let actCum = 0;
  const points: Point[] = sorted.map((t) => {
    const r = tradeR(t);
    actCum += r;
    if (isSystemTrade(t)) sysCum += r;
    return {
      t: new Date(t.executed_at).getTime(),
      label: new Date(t.executed_at).toLocaleDateString(),
      system: Number(sysCum.toFixed(3)),
      actual: Number(actCum.toFixed(3)),
    };
  });

  if (points.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-[#A1A1AA]">
        Log closed trades to see your edge curve.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FACC15" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#FACC15" stopOpacity={0} />
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
            width={40}
            tickFormatter={(v) => `${v}R`}
          />
          <Tooltip
            contentStyle={{
              background: "#111114",
              border: "1px solid #1F1F23",
              borderRadius: 10,
              color: "#FFFFFF",
              fontSize: 12,
            }}
            labelStyle={{ color: "#A1A1AA" }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)}R`,
              name === "system" ? "System edge" : name === "actual" ? "Actual" : name,
            ]}
          />
          {/* Gap area = system minus actual, shaded yellow */}
          <Area
            type="monotone"
            dataKey="system"
            stroke="transparent"
            fill="url(#gapFill)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="system"
            stroke="#22C55E"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#FFFFFF"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 text-xs text-[#A1A1AA] mt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: "#22C55E" }} />
          System edge (clean)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-white" />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: "#FACC15", opacity: 0.5 }} />
          Execution gap
        </span>
      </div>
    </div>
  );
}
