// Color-as-feedback — single source of truth.
//
// Every metric reflecting discipline / performance state must use these
// helpers so the value itself (number, label, badge) communicates state at
// a glance, without the user reading words.
//
// Thresholds (per spec, applied to all percentage-style metrics):
//   ≥ 75   → green   (#22C55E)  healthy
//   50–74  → yellow  (#FACC15)  drift / caution / trending down
//   < 50   → red     (#EF4444)  critical
//
// "Trending down" amplification: if `trend` is "down", a healthy score is
// demoted from green to yellow so the user sees the regression instantly.

export type MetricTone = "good" | "warn" | "bad" | "neutral";
export type MetricTrend = "up" | "down" | "flat" | undefined;

export const METRIC_HEX: Record<MetricTone, string> = {
  good:    "#22C55E",
  warn:    "#FACC15",
  bad:     "#EF4444",
  neutral: "#A1A1AA",
};

/**
 * Resolve tone for a 0–100 percentage-style metric (Discipline Score,
 * Behavior Score, Rule Adherence %, Win Rate %, etc.).
 *
 * @param value  0–100, or null/undefined for neutral.
 * @param trend  Optional. "down" demotes good → warn (so a slipping
 *               healthy score reads yellow, not green).
 */
export function metricTone(
  value: number | null | undefined,
  trend?: MetricTrend,
): MetricTone {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value < 50) return "bad";
  if (value < 75) return "warn";
  return trend === "down" ? "warn" : "good";
}

/** Inline color for the value itself — apply to the number/label, never the
 *  background. Pair with `tabular-nums` and a strong weight. */
export function metricColorStyle(
  value: number | null | undefined,
  trend?: MetricTrend,
): { color: string } {
  return { color: METRIC_HEX[metricTone(value, trend)] };
}

/** Tailwind text class equivalent — when an explicit class is preferred over
 *  inline style. Maps to the global palette remap (#22C55E / #FACC15 /
 *  #EF4444 / #A1A1AA). */
export function metricTextClass(
  value: number | null | undefined,
  trend?: MetricTrend,
): string {
  switch (metricTone(value, trend)) {
    case "good":    return "text-emerald-500";
    case "warn":    return "text-yellow-400";
    case "bad":     return "text-red-500";
    case "neutral": return "text-text-secondary";
  }
}

/** Soft tinted background + ring for badge/chip surfaces (NOT for large
 *  containers — keep the value itself colored). */
export function metricBadgeClass(
  value: number | null | undefined,
  trend?: MetricTrend,
): string {
  switch (metricTone(value, trend)) {
    case "good":
      return "bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25";
    case "warn":
      return "bg-yellow-400/10 text-yellow-400 ring-1 ring-yellow-400/30";
    case "bad":
      return "bg-red-500/10 text-red-500 ring-1 ring-red-500/25";
    case "neutral":
      return "bg-white/[0.04] text-text-secondary ring-1 ring-border";
  }
}

/** Soft glow shadow that matches the tone — only use on intentional hero
 *  numbers (Discipline Score on the dashboard, etc.), never on rows. */
export function metricGlowShadow(
  value: number | null | undefined,
  trend?: MetricTrend,
): string {
  const t = metricTone(value, trend);
  if (t === "neutral") return "none";
  const rgb =
    t === "good" ? "34,197,94" : t === "warn" ? "250,204,21" : "239,68,68";
  return `0 0 28px rgba(${rgb}, 0.35)`;
}

/** Convenience for ratios in 0–1 (e.g. winRate from computeMetrics). */
export function metricToneFromRatio(
  ratio: number | null | undefined,
  trend?: MetricTrend,
): MetricTone {
  if (ratio == null || Number.isNaN(ratio)) return "neutral";
  return metricTone(ratio * 100, trend);
}
