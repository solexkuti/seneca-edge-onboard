/**
 * Intelligent Price Correction Engine
 * ────────────────────────────────────
 * Detects suspicious price inputs in the trade journal and proposes likely
 * corrections. Pure / side-effect-free: callers decide whether to surface
 * suggestions in the UI. NEVER mutates user input automatically.
 *
 * Triggers (any one fires):
 *   1. Digit-length mismatch — entry / exit / stop integer parts differ by ≥1.
 *   2. Extreme realized R   — |R| > 10.
 *   3. Distance anomaly     — reward distance > 10× risk distance.
 *
 * Candidate generation per suspicious field:
 *   • Strip trailing digits (76555 → 7655 → 765).
 *   • Divide by 10 / 100 / 1000 (decimal-misplacement guess).
 *   • Re-scale to the dominant magnitude implied by the other two fields.
 *
 * Scoring: each candidate is rescored against the original two non-suspicious
 * fields and the resulting RR. We keep candidates that:
 *   • match the dominant integer-digit length of the other fields,
 *   • produce |R| ≤ 5 (sane RR window),
 *   • preserve sign of R (profit/loss intent stays the same when possible).
 */

import { calculateR, type Direction } from "@/lib/priceValidation";

export type FieldId = "entry" | "exit" | "stop";

export type PriceCandidate = {
  field: FieldId;
  /** The original value the user typed. */
  original: number;
  /** Proposed replacement. */
  suggested: number;
  /** Short label describing the transformation (for UI only). */
  rationale: string;
  /** R that the trade would produce after applying this single suggestion. */
  projectedR: number | null;
  /** Internal score — higher = better fit. */
  score: number;
};

export type CorrectionSuggestion = {
  field: FieldId;
  /** Top candidate. */
  primary: PriceCandidate;
  /** Optional second-best candidate, only when meaningfully different. */
  alternate: PriceCandidate | null;
};

export type CorrectionAnalysis = {
  /** Whether the engine wants to surface a correction modal at all. */
  triggered: boolean;
  /** Why we triggered — user-facing reason chips. */
  reasons: Array<
    | "digit_length_mismatch"
    | "extreme_rr"
    | "distance_anomaly"
  >;
  /** R computed from the user's raw inputs (or null when undefined). */
  currentR: number | null;
  /** One suggestion per field that the engine thinks is wrong. */
  suggestions: CorrectionSuggestion[];
};

// ── helpers ───────────────────────────────────────────────────────────

function intDigits(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const abs = Math.abs(Math.trunc(n));
  return abs === 0 ? 1 : String(abs).length;
}

/** Most common integer-digit length among the supplied finite numbers. */
function dominantDigits(values: number[]): number | null {
  const ds = values.filter((v) => Number.isFinite(v) && v !== 0).map(intDigits);
  if (ds.length === 0) return null;
  const counts = new Map<number, number>();
  for (const d of ds) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best = ds[0];
  let bestCount = 0;
  for (const [d, c] of counts) {
    if (c > bestCount || (c === bestCount && d < best)) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}

/** Generate raw rescaling candidates for a single value. */
function generateRawCandidates(value: number, targetDigits: number | null): number[] {
  const out = new Set<number>();
  if (!Number.isFinite(value) || value === 0) return [];

  const sign = Math.sign(value);
  const abs = Math.abs(value);

  // Drop trailing digits one at a time.
  let s = String(Math.trunc(abs));
  while (s.length > 1) {
    s = s.slice(0, -1);
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) out.add(sign * n);
  }

  // Power-of-ten rescales (decimal misplacement).
  for (const div of [10, 100, 1000, 10000]) {
    const n = Math.round((abs / div) * 1000) / 1000; // keep 3 decimals
    if (n > 0) out.add(sign * n);
  }

  // Force-align to dominant digit length.
  if (targetDigits != null) {
    const currentDigits = intDigits(abs);
    if (currentDigits > targetDigits) {
      const factor = Math.pow(10, currentDigits - targetDigits);
      const n = Math.round((abs / factor) * 1000) / 1000;
      if (n > 0) out.add(sign * n);
    }
  }

  // Drop the original value itself.
  out.delete(value);
  return Array.from(out);
}

// ── public API ────────────────────────────────────────────────────────

/**
 * Run the full detection + suggestion pipeline.
 *
 * Returns `triggered=false` when the inputs look fine. When triggered, the
 * caller should display a modal listing `suggestions` and ASK before applying
 * any change.
 */
export function analyzeForCorrection(args: {
  direction: Direction;
  entry: number | null;
  exit: number | null;
  stop: number | null;
}): CorrectionAnalysis {
  const { direction, entry, exit, stop } = args;
  const reasons: CorrectionAnalysis["reasons"] = [];

  // Need at least entry + stop to reason about anything.
  if (
    entry == null ||
    !Number.isFinite(entry) ||
    stop == null ||
    !Number.isFinite(stop)
  ) {
    return { triggered: false, reasons: [], currentR: null, suggestions: [] };
  }

  const currentR = calculateR({ direction, entry, exit, stop });

  // Trigger 1 — digit-length mismatch across the 3 prices.
  const digitsList: Array<{ field: FieldId; d: number; v: number }> = [];
  if (entry !== 0) digitsList.push({ field: "entry", d: intDigits(entry), v: entry });
  if (exit != null && Number.isFinite(exit) && exit !== 0)
    digitsList.push({ field: "exit", d: intDigits(exit), v: exit });
  if (stop !== 0) digitsList.push({ field: "stop", d: intDigits(stop), v: stop });

  const allDigits = digitsList.map((x) => x.d);
  const minD = Math.min(...allDigits);
  const maxD = Math.max(...allDigits);
  if (digitsList.length >= 2 && maxD - minD >= 1) {
    reasons.push("digit_length_mismatch");
  }

  // Trigger 2 — extreme RR.
  if (currentR != null && Math.abs(currentR) > 10) reasons.push("extreme_rr");

  // Trigger 3 — distance anomaly (reward >> risk).
  if (exit != null && Number.isFinite(exit)) {
    const riskDist = Math.abs(entry - stop);
    const rewardDist = Math.abs(exit - entry);
    if (riskDist > 0 && rewardDist > 10 * riskDist) {
      reasons.push("distance_anomaly");
    }
  }

  if (reasons.length === 0) {
    return { triggered: false, reasons: [], currentR, suggestions: [] };
  }

  // Identify which fields look out of scale.
  const target = dominantDigits([entry, exit ?? NaN, stop].filter((n) => Number.isFinite(n) as boolean) as number[]);
  const suspectFields: FieldId[] = [];
  for (const item of digitsList) {
    if (target != null && Math.abs(item.d - target) >= 1) suspectFields.push(item.field);
  }
  // If nothing looks scale-wise wrong but R is extreme, suspect exit first
  // (most common: the user logs an exit that drifts from the entry decimals).
  if (suspectFields.length === 0) {
    if (exit != null && Number.isFinite(exit)) suspectFields.push("exit");
    else suspectFields.push("stop");
  }

  // Build candidates per suspect field.
  const suggestions: CorrectionSuggestion[] = [];
  for (const field of suspectFields) {
    const original =
      field === "entry" ? entry : field === "exit" ? (exit as number) : stop;
    if (original == null || !Number.isFinite(original)) continue;

    const raw = generateRawCandidates(original, target);
    const scored: PriceCandidate[] = [];
    for (const sug of raw) {
      // Project R using this candidate, holding the other two fields constant.
      const projected = calculateR({
        direction,
        entry: field === "entry" ? sug : entry,
        exit: field === "exit" ? sug : exit,
        stop: field === "stop" ? sug : stop,
      });

      // Score:
      //   +5  candidate matches dominant digit length
      //   +5  resulting |R| ≤ 5 (sane RR window)
      //   +2  resulting |R| ≤ 2 (very plausible)
      //   +2  resulting R sign matches currentR sign (preserves intent)
      //   −3  resulting denominator invalid (R == null)
      let score = 0;
      if (target != null && intDigits(sug) === target) score += 5;
      if (projected != null && Math.abs(projected) <= 5) score += 5;
      if (projected != null && Math.abs(projected) <= 2) score += 2;
      if (
        currentR != null &&
        projected != null &&
        Math.sign(currentR) === Math.sign(projected) &&
        Math.sign(projected) !== 0
      ) {
        score += 2;
      }
      if (projected == null) score -= 3;

      // Cheap rationale label.
      let rationale = "Rescaled";
      const sd = intDigits(sug);
      const od = intDigits(original);
      if (od - sd === 1) rationale = "Drop last digit";
      else if (od - sd === 2) rationale = "Move decimal 2 places";
      else if (od - sd >= 3) rationale = `Move decimal ${od - sd} places`;
      else if (target != null && sd === target) rationale = "Match other prices";

      scored.push({
        field,
        original,
        suggested: sug,
        rationale,
        projectedR: projected,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const primary = scored[0];
    if (!primary || primary.score <= 0) continue;
    const alternate =
      scored[1] && scored[1].score > 0 && scored[1].suggested !== primary.suggested
        ? scored[1]
        : null;

    suggestions.push({ field, primary, alternate });
  }

  // If after scoring nothing meaningful came out, untrigger to avoid noise.
  if (suggestions.length === 0) {
    return { triggered: false, reasons, currentR, suggestions: [] };
  }

  return { triggered: true, reasons, currentR, suggestions };
}

/** Format helpers (UI-side convenience). */
export function fieldLabel(field: FieldId): string {
  return field === "entry" ? "Entry" : field === "exit" ? "Exit" : "Stop loss";
}

/** Trim trailing zeros after decimal for clean display. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const fixed = n.toFixed(5);
  return fixed.replace(/\.?0+$/, "");
}
