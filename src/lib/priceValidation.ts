/**
 * RR Validation + Price Sanity Engine
 *
 * Pure, side-effect-free validation layer for trade journal price inputs.
 * Goals:
 *   1. Detect structurally impossible inputs (hard block).
 *   2. Detect suspicious-but-possible inputs (warn + require confirm).
 *   3. Never silently mutate user data — always explain.
 *
 * The scoring engine is untouched. This layer only gates the journal Continue
 * step and surfaces warnings to the user.
 */

export type Direction = "buy" | "sell";

export type ValidationIssue = {
  /** "block" prevents Continue. "warn" allows Continue once confirmed. */
  level: "block" | "warn";
  /** Stable id so the UI can target/dedupe specific issues. */
  code:
    | "missing_entry"
    | "missing_stop"
    | "missing_direction"
    | "denominator_zero"
    | "sl_invalid_placement"
    | "tp_invalid_placement"
    | "price_scale_mismatch"
    | "extreme_distance"
    | "rr_out_of_range"
    | "manual_mismatch";
  message: string;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  hasBlock: boolean;
  hasWarn: boolean;
  /** R computed from entry/exit/SL using the spec formula, or null when not derivable. */
  calculatedR: number | null;
  /** True when entry/SL/direction structure is sane and denominator ≠ 0. */
  structurallyValid: boolean;
};

const RR_HARD_CAP = 10;
const EXTREME_RATIO = 10;
const MANUAL_MISMATCH_TOLERANCE = 0.2;

/** Length of the integer part of a positive number (ignores sign and decimals). */
function intDigits(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const abs = Math.abs(Math.trunc(n));
  return abs === 0 ? 1 : String(abs).length;
}

/**
 * Compute realized R using the spec-defined formula:
 *   buy:  (Exit - Entry) / (Entry - StopLoss)
 *   sell: (Entry - Exit) / (StopLoss - Entry)
 * Returns null when not derivable (missing inputs or zero denominator).
 */
export function calculateR(args: {
  direction: Direction;
  entry: number | null;
  exit: number | null;
  stop: number | null;
}): number | null {
  const { direction, entry, exit, stop } = args;
  if (entry == null || exit == null || stop == null) return null;
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || !Number.isFinite(stop)) return null;
  const denom = direction === "buy" ? entry - stop : stop - entry;
  if (!Number.isFinite(denom) || denom === 0) return null;
  const numer = direction === "buy" ? exit - entry : entry - exit;
  return numer / denom;
}

/**
 * Validate price inputs and (optionally) a manually-entered R against the
 * computed R. Returns an issue list — `hasBlock` means Continue must be
 * disabled; `hasWarn` means Continue requires explicit user confirmation.
 */
export function validateTradePrices(args: {
  direction: Direction | null | undefined;
  entry: number | null;
  exit: number | null;
  stop: number | null;
  /** Optional — only used for the manual-vs-calculated mismatch check. */
  manualR?: number | null;
}): ValidationResult {
  const { direction, entry, exit, stop, manualR } = args;
  const issues: ValidationIssue[] = [];

  // ── Hard blocks: missing required pieces ─────────────────────────────
  if (!direction) {
    issues.push({
      level: "block",
      code: "missing_direction",
      message: "Select a trade direction (Buy or Sell).",
    });
  }
  if (entry == null || !Number.isFinite(entry)) {
    issues.push({
      level: "block",
      code: "missing_entry",
      message: "Entry price is required.",
    });
  }
  if (stop == null || !Number.isFinite(stop)) {
    issues.push({
      level: "block",
      code: "missing_stop",
      message: "Stop loss is required.",
    });
  }

  // ── Structural validity (only check if we have entry, SL, direction) ─
  let structurallyValid = false;
  if (
    direction &&
    entry != null &&
    Number.isFinite(entry) &&
    stop != null &&
    Number.isFinite(stop)
  ) {
    if (entry === stop) {
      issues.push({
        level: "block",
        code: "denominator_zero",
        message: "Stop loss cannot equal entry — risk distance is zero.",
      });
    } else if (direction === "buy" && stop > entry) {
      issues.push({
        level: "block",
        code: "sl_invalid_placement",
        message: "Stop loss placement is invalid for this trade direction. On a Buy, stop must be below entry.",
      });
    } else if (direction === "sell" && stop < entry) {
      issues.push({
        level: "block",
        code: "sl_invalid_placement",
        message: "Stop loss placement is invalid for this trade direction. On a Sell, stop must be above entry.",
      });
    } else {
      structurallyValid = true;
    }
  }

  // ── Price scale check (entry/exit/SL integer-digit length should match) ─
  const prices: { value: number; }[] = [];
  if (entry != null && Number.isFinite(entry) && entry !== 0) prices.push({ value: entry });
  if (exit != null && Number.isFinite(exit) && exit !== 0) prices.push({ value: exit });
  if (stop != null && Number.isFinite(stop) && stop !== 0) prices.push({ value: stop });
  if (prices.length >= 2) {
    const digits = prices.map((p) => intDigits(p.value));
    const allSame = digits.every((d) => d === digits[0]);
    if (!allSame) {
      issues.push({
        level: "warn",
        code: "price_scale_mismatch",
        message:
          "Price values look inconsistent. Ensure all prices use the same format (e.g. 5455 vs 7655, not 76555).",
      });
    }
  }

  // ── Extreme distance check (reward >> risk) ─────────────────────────
  if (
    structurallyValid &&
    entry != null &&
    exit != null &&
    stop != null &&
    Number.isFinite(exit)
  ) {
    const riskDist = Math.abs(entry - stop);
    const rewardDist = Math.abs(exit - entry);
    if (riskDist > 0 && rewardDist > EXTREME_RATIO * riskDist) {
      issues.push({
        level: "warn",
        code: "extreme_distance",
        message: "Your trade move is unusually large compared to your risk. Please verify your inputs.",
      });
    }
  }

  // ── Calculated R + hard cap ──────────────────────────────────────────
  const calculatedR = structurallyValid
    ? calculateR({ direction: direction as Direction, entry, exit, stop })
    : null;

  if (calculatedR != null && Math.abs(calculatedR) > RR_HARD_CAP) {
    issues.push({
      level: "warn",
      code: "rr_out_of_range",
      message: "RR exceeds normal trading range. Confirm this is intentional.",
    });
  }

  // ── Manual vs calculated R mismatch ──────────────────────────────────
  if (
    calculatedR != null &&
    manualR != null &&
    Number.isFinite(manualR) &&
    Math.abs(manualR - calculatedR) > MANUAL_MISMATCH_TOLERANCE
  ) {
    issues.push({
      level: "warn",
      code: "manual_mismatch",
      message: "Your manual result differs from the calculated value.",
    });
  }

  return {
    issues,
    hasBlock: issues.some((i) => i.level === "block"),
    hasWarn: issues.some((i) => i.level === "warn"),
    calculatedR,
    structurallyValid,
  };
}
