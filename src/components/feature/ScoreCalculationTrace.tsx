// ScoreCalculationTrace — Cumulative model trace.
//
// Shows the latest discipline delta and the resulting cumulative score. No
// recency weighting, no normalization. Mirrors the formula in
// src/lib/disciplineScore.ts: start 100, +10 clean, -10 per violation.

import { Calculator, ArrowRight } from "lucide-react";
import { useTraderState } from "@/hooks/useTraderState";
import {
  CLEAN_TRADE_DELTA,
  STARTING_SCORE,
  VIOLATION_DELTA,
} from "@/lib/disciplineScore";

export default function ScoreCalculationTrace() {
  const { state } = useTraderState();
  if (state.loading) return null;

  const bd = state.discipline.breakdown;
  const recent = bd.recent_contributions;
  const sample = recent.length;
  const latest = recent[0];

  return (
    <div className="card-premium p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/50 ring-1 ring-border">
          <Calculator className="h-3.5 w-3.5 text-foreground/70" aria-hidden />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            How your score was calculated
          </div>
          <div className="text-[11px] text-foreground/70">
            Cumulative · {sample} trade{sample === 1 ? "" : "s"} replayed
          </div>
        </div>
      </div>

      {latest && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 ring-1 ring-border">
          <div className="text-[11px] text-foreground/75">Latest delta</div>
          <div className="font-mono text-[11px] text-foreground/85">
            <span className="font-semibold text-foreground">
              {latest.raw > 0 ? "+" : ""}
              {latest.raw}
            </span>
            <ArrowRight className="mx-1.5 inline h-3 w-3 text-foreground/40" aria-hidden />
            <span className="font-semibold text-foreground">
              {latest.value}/100
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-muted/30 p-3 ring-1 ring-border">
        <div className="font-mono text-[10.5px] leading-relaxed text-foreground/75">
          start {STARTING_SCORE} · clean trade {CLEAN_TRADE_DELTA >= 0 ? "+" : ""}
          {CLEAN_TRADE_DELTA} · per violation {VIOLATION_DELTA} · clamp 0–100
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Discipline score
          </div>
          <span className="text-base font-semibold text-foreground">
            {bd.score}
            <span className="text-[11px] font-normal text-foreground/55"> / 100</span>
          </span>
        </div>
      </div>

      {sample === 0 && (
        <div className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
          No trades logged yet — score holds at the {STARTING_SCORE} baseline
          until your first trade.
        </div>
      )}
    </div>
  );
}
