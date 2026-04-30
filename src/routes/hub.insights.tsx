import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Scale,
  AlertTriangle,
  Brain,
} from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";
import { useBehavioralJournal } from "@/hooks/useBehavioralJournal";
import { usePerformance } from "@/hooks/usePerformance";

export const Route = createFileRoute("/hub/insights")({
  head: () => ({
    meta: [{ title: "Insights — SenecaEdge" }],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  // Read-only: existing hooks. No new logic, no engine changes.
  const { entries, score } = useBehavioralJournal(60);
  const perf = usePerformance(60);

  const total = entries.length;
  const wr = perf?.metrics?.winRate;
  const winRate = typeof wr === "number" && perf?.hasTrades ? Math.round(wr * 100) : null;
  const ruleAdherence = score != null ? Math.round(score) : null;
  const gap =
    winRate != null && ruleAdherence != null
      ? Math.abs(winRate - ruleAdherence)
      : null;

  return (
    <HubPageContainer
      eyebrow="Intelligence"
      title="Insights"
      subtitle="The gap between what you planned and what you executed — surfaced as patterns, not just numbers."
      wide
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <InsightCard
          Icon={Scale}
          eyebrow="Strategy vs execution"
          title={
            gap != null ? `${gap}% gap between intent and action` : "Awaiting data"
          }
          body={
            gap != null
              ? "Where rule adherence lags win rate, profitability is leaking from the system — not the market."
              : "Log a few trades to surface the gap between your plan and your execution."
          }
          accent
        />
        <InsightCard
          Icon={TrendingUp}
          eyebrow="Win rate vs rule adherence"
          title={
            winRate != null && ruleAdherence != null
              ? `${winRate}% wins · ${ruleAdherence}% adherence`
              : "Not enough trades yet"
          }
          body="High win rate with low adherence usually means you're being rewarded for breaking rules. The market eventually corrects this."
        />
        <InsightCard
          Icon={AlertTriangle}
          eyebrow="Mistake frequency"
          title={total > 0 ? `${total} trades observed` : "No journal entries"}
          body="Recurring mistakes are tracked across your journal. The fewer unique repeat patterns, the cleaner your edge."
        />
        <InsightCard
          Icon={Brain}
          eyebrow="Behavior patterns"
          title="Patterns are tracked silently"
          body="Seneca surfaces drift, revenge trading, and overtrading as they emerge. Visit your dashboard for live signals."
        />
      </div>

      <div className="mt-8 rounded-2xl border border-white/[0.06] bg-[#16181D] p-6">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">
          Note
        </p>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary">
          Deeper analytical breakdowns — equity curve, drawdown distribution, time-of-day clustering — will surface here as your journal matures.
        </p>
      </div>
    </HubPageContainer>
  );
}

function InsightCard({
  Icon,
  eyebrow,
  title,
  body,
  accent,
}: {
  Icon: typeof TrendingUp;
  eyebrow: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={[
        "relative overflow-hidden rounded-2xl border bg-[#16181D] p-6",
        accent
          ? "border-gold/25 shadow-[0_0_32px_-12px_rgba(198,161,91,0.35)]"
          : "border-white/[0.06]",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-[18px] w-[18px] text-gold" strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
            {eyebrow}
          </p>
          <h3 className="mt-1.5 font-display text-[19px] font-semibold leading-snug tracking-tight text-text-primary">
            {title}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
            {body}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
