// PriceCorrectionModal — surfaces the intelligent price-correction engine.
//
// Behavior rules (locked):
//   • Never auto-corrects. The user picks per field: Use suggested / Keep
//     original / Edit manually.
//   • Always shows the resulting R impact for each option so the user can
//     see why a suggestion is better.
//   • When the user keeps original values, the trade is marked
//     `data_quality: "low"` upstream — never silently.

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import {
  fieldLabel,
  formatPrice,
  type CorrectionAnalysis,
  type FieldId,
  type PriceCandidate,
} from "@/lib/priceCorrection";

type Props = {
  open: boolean;
  analysis: CorrectionAnalysis | null;
  /** Repeat-mistake hint shown above the suggestions, if any. */
  repeatHint?: string | null;
  onApplyCandidate: (field: FieldId, candidate: PriceCandidate) => void;
  onKeepOriginal: () => void;
  onEditManually: () => void;
  onClose: () => void;
};

const REASON_LABEL: Record<CorrectionAnalysis["reasons"][number], string> = {
  digit_length_mismatch: "Inconsistent number of digits",
  extreme_rr: "RR outside normal range",
  distance_anomaly: "Reward distance unusually large",
};

export function PriceCorrectionModal({
  open,
  analysis,
  repeatHint,
  onApplyCandidate,
  onKeepOriginal,
  onEditManually,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && analysis && analysis.triggered && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#0B0B0D]/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="card"
            initial={{ y: 20, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-card ring-1 ring-amber-500/25 shadow-glow-gold p-5 text-text-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-amber-500/15 ring-1 ring-amber-500/30 p-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                </div>
                <div>
                  <p className="font-display text-[15px] leading-tight">
                    Input looks unusual
                  </p>
                  <p className="text-[11.5px] text-text-secondary mt-0.5">
                    We noticed a possible input issue.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-text-secondary hover:text-text-primary hover:bg-card transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {analysis.reasons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {analysis.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-amber-500/10 ring-1 ring-amber-500/25 px-2 py-0.5 text-[10.5px] font-medium text-amber-200"
                  >
                    {REASON_LABEL[r]}
                  </span>
                ))}
              </div>
            )}

            {repeatHint && (
              <div className="mt-3 rounded-lg bg-primary/10 ring-1 ring-primary/25 px-3 py-2 text-[11.5px] text-text-secondary">
                {repeatHint}
              </div>
            )}

            {analysis.currentR != null && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-card ring-1 ring-border px-3 py-2 text-[12px]">
                <span className="text-text-secondary">Current result</span>
                <span
                  className={`font-semibold tabular-nums ${
                    analysis.currentR >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {analysis.currentR > 0 ? "+" : ""}
                  {analysis.currentR.toFixed(2)}R
                </span>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {analysis.suggestions.map((s) => (
                <div
                  key={s.field}
                  className="rounded-xl bg-card ring-1 ring-border px-3 py-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
                      {fieldLabel(s.field)}
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      You entered{" "}
                      <span className="text-text-primary font-semibold tabular-nums">
                        {formatPrice(s.primary.original)}
                      </span>
                    </p>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {[s.primary, s.alternate].filter(Boolean).map((c) => {
                      const cand = c as PriceCandidate;
                      return (
                        <button
                          key={`${cand.field}-${cand.suggested}`}
                          type="button"
                          onClick={() => onApplyCandidate(s.field, cand)}
                          className="w-full text-left rounded-lg ring-1 ring-primary/30 bg-primary/10 hover:bg-primary/15 px-3 py-2 transition active:scale-[0.99]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-text-primary font-semibold tabular-nums text-[13.5px]">
                                {formatPrice(cand.suggested)}
                              </span>
                              <span className="text-[10.5px] text-text-secondary">
                                {cand.rationale}
                              </span>
                            </div>
                            {cand.projectedR != null && (
                              <span
                                className={`text-[11.5px] font-semibold tabular-nums ${
                                  cand.projectedR >= 0
                                    ? "text-emerald-300"
                                    : "text-rose-300"
                                }`}
                              >
                                {cand.projectedR > 0 ? "+" : ""}
                                {cand.projectedR.toFixed(2)}R
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onEditManually}
                className="rounded-full ring-1 ring-border px-3.5 py-1.5 text-[11.5px] font-semibold text-text-secondary hover:text-text-primary transition"
              >
                Edit manually
              </button>
              <button
                type="button"
                onClick={onKeepOriginal}
                className="rounded-full ring-1 ring-amber-500/35 px-3.5 py-1.5 text-[11.5px] font-semibold text-amber-100 hover:bg-amber-500/10 transition"
              >
                Keep original
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
