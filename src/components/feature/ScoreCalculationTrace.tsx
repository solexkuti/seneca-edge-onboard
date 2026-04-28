// ScoreCalculationTrace — compact, deterministic math view of how the
// Decision Score was just computed, shown right after each analyzer event.
//
// Mirrors the formula in src/lib/disciplineScore.ts §3:
//   weighted_sum  = Σ(event_raw × weight)
//   max_possible  = Σ(EVENT_MAX × weight)
//   min_possible  = Σ(EVENT_MIN × weight)
//   decision_score = (weighted_sum - min_possible) / (max_possible - min_possible) * 100
//
// Reads from the trader-state breakdown so there's no extra DB call and the
// numbers always match the engine.

import { Calculator, ArrowRight } from "lucide-react";
import { useTraderState } from "@/hooks/useTraderState";
import { EVENT_SCORE_MAX, EVENT_SCORE_MIN } from "@/lib/disciplineScore";

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function ScoreCalculationTrace() {
  const { state } = useTraderState();
  if (state.loading) return null;

  const bd = state.discipline.breakdown;
  const contribs = bd.decision_contributions;
  const sample = contribs.length;

  // Compute the three transparent intermediates from the same contributions
  // the engine used. If sample === 0 the engine returns the neutral 50 baseline.
  let weightedSum = 0;
  let maxPossible = 0;
  let minPossible = 0;
  for (const c of contribs) {
    weightedSum += c.raw * c.weight;
    maxPossible += EVENT_SCORE_MAX * c.weight;
    minPossible += EVENT_SCORE_MIN * c.weight;
  }
  const range = maxPossible - minPossible;
  const normalized =
    sample === 0 || range === 0
      ? 50
      : ((weightedSum - minPossible) / range) * 100;

  // The latest event = first contribution (newest-first).
  const latest = contribs[0];

  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/50 ring-1 ring-border">
          <Calculator className="h-3.5 w-3.5 text-foreground/70" aria-hidden />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            How your score was calculated
          </div>
          <div className="text-[11px] text-foreground/70">
            Decision layer · last {sample}/10 analyzer event{sample === 1 ? "" : "s"} ·
            recency-weighted
          </div>
        </div>
      </div>

      {/* Latest event delta */}
      {latest && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 ring-1 ring-border">
          <div className="text-[11px] text-foreground/75">
            Latest event
            <span className="ml-1.5 rounded-md bg-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/80 ring-1 ring-border">
              {latest.klass?.replace("_", " ") ?? "—"}
            </span>
          </div>
          <div className="font-mono text-[11px] text-foreground/85">
            raw {latest.raw >= 0 ? "+" : ""}
            {latest.raw} × w {fmt(latest.weight, 2)} ={" "}
            <span className="font-semibold text-foreground">
              {latest.raw * latest.weight >= 0 ? "+" : ""}
              {fmt(latest.raw * latest.weight, 2)}
            </span>
          </div>
        </div>
      )}

      {/* Math block */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="weighted_sum" value={fmt(weightedSum, 2)} tone="primary" />
        <Stat label="min_possible" value={fmt(minPossible, 2)} tone="muted" />
        <Stat label="max_possible" value={fmt(maxPossible, 2)} tone="muted" />
      </div>

      {/* Formula → result */}
      <div className="mt-3 rounded-xl bg-muted/30 p-3 ring-1 ring-border">
        <div className="font-mono text-[10.5px] leading-relaxed text-foreground/75">
          decision = (weighted_sum − min_possible) / (max_possible − min_possible) × 100
        </div>
        <div className="mt-1 font-mono text-[10.5px] leading-relaxed text-foreground/85">
          = ({fmt(weightedSum, 2)} − {fmt(minPossible, 2)}) / (
          {fmt(maxPossible, 2)} − {fmt(minPossible, 2)}) × 100
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Decision Score
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[11px] text-foreground/60">
              {fmt(normalized, 1)}
            </span>
            <ArrowRight className="h-3 w-3 text-foreground/40" aria-hidden />
            <span className="text-base font-semibold text-foreground">
              {bd.decision_score}
              <span className="text-[11px] font-normal text-foreground/55">
                {" "}/ 100
              </span>
            </span>
          </div>
        </div>
      </div>

      {sample === 0 && (
        <div className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
          No prior analyzer events — neutral baseline (50) applies until the first
          event lands in the window.
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "muted";
}) {
  const ring =
    tone === "primary"
      ? "bg-card ring-border"
      : "bg-muted/40 ring-border";
  const valueTone =
    tone === "primary" ? "text-foreground" : "text-foreground/75";
  return (
    <div className={`rounded-xl px-2.5 py-2 ring-1 ${ring}`}>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-[12.5px] font-semibold ${valueTone}`}>
        {value}
      </div>
    </div>
  );
}
