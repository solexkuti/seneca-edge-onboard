// SsotAlerts — read-only alert surface derived from the SSOT.
//
// Hybrid posture: surfaces hardened insights, never hard-blocks. All numbers
// come from useSsot() — never recompute here.

import { Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldAlert, TrendingDown, Wallet } from "lucide-react";
import { useSsot } from "@/hooks/useSsot";
import { metricColorStyle, metricTone } from "@/lib/metricColor";

type Severity = "warn" | "critical" | "info";

interface Alert {
  id: string;
  severity: Severity;
  icon: typeof AlertTriangle;
  title: string;
  body: string;
  cta?: { label: string; to: string };
}

const SEV_RING: Record<Severity, string> = {
  critical: "border-red-500/30 bg-red-500/[0.04]",
  warn: "border-yellow-400/30 bg-yellow-400/[0.04]",
  info: "border-white/[0.06] bg-white/[0.02]",
};

const SEV_ICON: Record<Severity, string> = {
  critical: "text-red-500",
  warn: "text-yellow-400",
  info: "text-text-secondary",
};

export default function SsotAlerts() {
  const { ssot } = useSsot();
  if (ssot.loading) return null;

  const alerts: Alert[] = [];

  // Discipline state — gradual-recovery vocabulary, no gameable language.
  const ds = ssot.behavior.discipline_score;
  if (metricTone(ds) === "bad") {
    alerts.push({
      id: "discipline-critical",
      severity: "critical",
      icon: ShieldAlert,
      title: `Discipline at ${ds}`,
      body: "Recent trades show impulsive execution. Slow down — discipline recovers gradually, not in one trade.",
      cta: { label: "Review breakdown", to: "/hub/journal/breakdown" },
    });
  } else if (metricTone(ds) === "warn") {
    alerts.push({
      id: "discipline-warn",
      severity: "warn",
      icon: ShieldAlert,
      title: `Consistency unstable (${ds})`,
      body: "Execution quality slipping. Stay patient — the score rebuilds slowly with consistent clean trades.",
      cta: { label: "Open insights", to: "/hub/insights" },
    });
  }

  // Rule adherence
  const adherencePct = Math.round(ssot.behavior.rule_adherence * 100);
  if (
    ssot.behavior.total_trades >= 5 &&
    metricTone(adherencePct) !== "good" &&
    metricTone(adherencePct) !== "neutral"
  ) {
    alerts.push({
      id: "adherence",
      severity: metricTone(adherencePct) === "bad" ? "critical" : "warn",
      icon: AlertTriangle,
      title: `Rule adherence ${adherencePct}%`,
      body: `${ssot.behavior.clean_trades} of ${ssot.behavior.total_trades} trades clean. ${
        ssot.metrics.worst_rule_break
          ? `Most repeated break: ${ssot.metrics.worst_rule_break}.`
          : "Lock the rule you keep breaking."
      }`,
      cta: { label: "Open insights", to: "/hub/insights" },
    });
  }

  // Drawdown spike
  if (ssot.metrics.max_drawdown_r >= 5) {
    alerts.push({
      id: "drawdown",
      severity: ssot.metrics.max_drawdown_r >= 8 ? "critical" : "warn",
      icon: TrendingDown,
      title: `Drawdown ${ssot.metrics.max_drawdown_r.toFixed(1)}R`,
      body: "Peak-to-trough on cumulative R. Size down or pause until the curve stabilises.",
      cta: { label: "Performance breakdown", to: "/hub/insights" },
    });
  }

  // Missing balance
  if (ssot.account.balance == null) {
    alerts.push({
      id: "balance-missing",
      severity: "warn",
      icon: Wallet,
      title: "Account balance not set",
      body: "Discipline and risk math need a real balance. Set yours so risk-per-trade is honest.",
      cta: { label: "Set balance", to: "/hub/settings" },
    });
  }

  if (alerts.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80">
          Live alerts
        </h2>
        <span
          className="text-[10.5px] uppercase tracking-[0.18em]"
          style={metricColorStyle(ds)}
        >
          From your data
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {alerts.map((a) => {
          const Icon = a.icon;
          return (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 ${SEV_RING[a.severity]}`}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={`h-4 w-4 mt-0.5 shrink-0 ${SEV_ICON[a.severity]}`}
                  strokeWidth={2.2}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary">
                    {a.title}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
                    {a.body}
                  </p>
                  {a.cta && (
                    <Link
                      to={a.cta.to}
                      className="mt-2 inline-flex items-center text-[12px] font-semibold text-gold hover:text-gold-soft"
                    >
                      {a.cta.label} →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
