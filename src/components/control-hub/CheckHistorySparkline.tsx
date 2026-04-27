import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import {
  readCheckHistory,
  CHECK_HISTORY_EVENT,
  CHECK_HISTORY_KEY,
  type CheckRecord,
} from "@/lib/behaviorLog";

/**
 * Compact sparkline visualizing the user's recent Check Before Trade history.
 * Two overlaid lines:
 *   - Risk %  (cyan/blue) — quantitative
 *   - Emotional bias (magenta) — binary, plotted as 0/1 area
 * Reads from localStorage; safe on SSR (renders skeleton until mounted).
 */

const W = 280;
const H = 64;
const PAD_X = 4;
const PAD_Y = 8;
const MAX_POINTS = 12;

export default function CheckHistorySparkline() {
  const [history, setHistory] = useState<CheckRecord[] | null>(null);

  useEffect(() => {
    const refresh = () => setHistory(readCheckHistory());
    refresh();

    const onFocus = () => refresh();
    const onLogged = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHECK_HISTORY_KEY) refresh();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(CHECK_HISTORY_EVENT, onLogged as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CHECK_HISTORY_EVENT, onLogged as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Animated skeleton on SSR / first paint
  if (history === null) {
    return (
      <Card>
        <SkeletonState />
      </Card>
    );
  }

  // Empty state
  if (history.length === 0) {
    return (
      <Card>
        <EmptyState />
      </Card>
    );
  }

  // Oldest → newest, last MAX_POINTS
  const points = [...history].reverse().slice(-MAX_POINTS);

  // Scales
  const maxRisk = Math.max(2, ...points.map((p) => p.riskPercent));
  const stepX =
    points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0;

  const xAt = (i: number) => PAD_X + i * stepX;
  const yRisk = (r: number) =>
    H - PAD_Y - ((r / maxRisk) * (H - PAD_Y * 2));
  const yBias = (b: boolean) => (b ? PAD_Y + 6 : H - PAD_Y - 6);

  // Path strings
  const riskPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yRisk(p.riskPercent)}`)
    .join(" ");

  const riskArea =
    points.length > 1
      ? `${riskPath} L ${xAt(points.length - 1)} ${H - PAD_Y} L ${xAt(0)} ${H - PAD_Y} Z`
      : "";

  const biasPath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${xAt(i)} ${yBias(p.emotionalBias)}`,
    )
    .join(" ");

  // Stats
  const avgRisk =
    points.reduce((s, p) => s + p.riskPercent, 0) / points.length;
  const biasCount = points.filter((p) => p.emotionalBias).length;
  const biasPct = Math.round((biasCount / points.length) * 100);

  // Trend on risk: compare first half vs second half
  const half = Math.max(1, Math.floor(points.length / 2));
  const firstAvg =
    points.slice(0, half).reduce((s, p) => s + p.riskPercent, 0) / half;
  const secondAvg =
    points.slice(-half).reduce((s, p) => s + p.riskPercent, 0) / half;
  const delta = secondAvg - firstAvg;
  const trend: "up" | "down" | "flat" =
    Math.abs(delta) < 0.15 ? "flat" : delta > 0 ? "up" : "down";

  return (
    <Card>
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-semibold tracking-tight text-text-primary">
            Check History
          </p>
          <p className="mt-0.5 text-[10.5px] text-text-secondary">
            Last {points.length} {points.length === 1 ? "scan" : "scans"} ·
            risk vs emotional bias
          </p>
        </div>
        <TrendBadge trend={trend} />
      </div>

      {/* Chart */}
      <div className="mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          className="block"
          aria-hidden
        >
          <defs>
            <linearGradient id="risk-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00C6FF" />
              <stop offset="100%" stopColor="#6C5CE7" />
            </linearGradient>
            <linearGradient id="risk-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00C6FF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#00C6FF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* baseline */}
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={H - PAD_Y}
            y2={H - PAD_Y}
            stroke="currentColor"
            className="text-text-secondary/15"
            strokeDasharray="2 3"
          />

          {/* Risk area */}
          {riskArea && <path d={riskArea} fill="url(#risk-fill)" />}

          {/* Risk line */}
          <motion.path
            d={riskPath}
            fill="none"
            stroke="url(#risk-stroke)"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Bias dotted line */}
          <motion.path
            d={biasPath}
            fill="none"
            stroke="#FF7AF5"
            strokeWidth={1.4}
            strokeDasharray="3 3"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            transition={{ delay: 0.25, duration: 0.9 }}
          />

          {/* Bias markers (only when emotional bias present) */}
          {points.map((p, i) =>
            p.emotionalBias ? (
              <motion.circle
                key={`b-${i}`}
                cx={xAt(i)}
                cy={yBias(true)}
                r={2.6}
                fill="#FF7AF5"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
              />
            ) : null,
          )}

          {/* Last risk point dot */}
          {points.length > 0 && (
            <>
              <motion.circle
                cx={xAt(points.length - 1)}
                cy={yRisk(points[points.length - 1].riskPercent)}
                r={3}
                fill="#00C6FF"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.95, duration: 0.4 }}
              />
              <motion.circle
                cx={xAt(points.length - 1)}
                cy={yRisk(points[points.length - 1].riskPercent)}
                r={6}
                fill="#00C6FF"
                opacity={0.3}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.6, 1] }}
                transition={{
                  delay: 0.95,
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            </>
          )}
        </svg>
      </div>

      {/* Footer stats + legend */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[10.5px] text-text-secondary">
          <LegendDot color="#00C6FF" label="Risk %" />
          <LegendDot color="#FF7AF5" label="Emotional bias" dashed />
        </div>
        <div className="flex items-center gap-3 text-[10.5px] font-medium text-text-secondary">
          <span>
            avg{" "}
            <span className="font-semibold text-text-primary">
              {avgRisk.toFixed(1)}%
            </span>
          </span>
          <span className="text-text-secondary/30">·</span>
          <span>
            bias{" "}
            <span className="font-semibold text-text-primary">{biasPct}%</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,198,255,0.18), transparent 70%)",
        }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00C6FF]/15 to-[#6C5CE7]/15 ring-1 ring-border">
        <Activity className="h-5 w-5 text-text-secondary" strokeWidth={2.1} />
      </div>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold tracking-tight text-text-primary">
          Check History
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-text-secondary">
          Run your first Check Before Trade to begin tracking risk and emotional
          bias.
        </p>
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: "up" | "down" | "flat" }) {
  const map = {
    up: {
      text: "Risk rising",
      cls: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
      arrow: "↗",
    },
    down: {
      text: "Risk easing",
      cls: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
      arrow: "↘",
    },
    flat: {
      text: "Stable",
      cls: "bg-text-secondary/10 text-text-secondary ring-border",
      arrow: "→",
    },
  }[trend];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${map.cls}`}
    >
      <span className="text-[11px] leading-none">{map.arrow}</span>
      {map.text}
    </span>
  );
}

function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-[2px] w-3.5 rounded-full"
        style={{
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`
            : color,
        }}
      />
      {label}
    </span>
  );
}
