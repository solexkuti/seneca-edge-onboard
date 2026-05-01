/**
 * Unified Trade Object — the single shape every Seneca Edge feature relies on.
 *
 * Pipeline: Raw Data → normalize() → Trade → analyze() → insights() → UI
 *
 * Sources (manual / Deriv / MT5) all funnel into this exact shape via the
 * normalizers in `src/lib/trade/normalize.ts`. Never bypass this type.
 */

export type TradeSource = "manual" | "deriv" | "mt5";
export type MarketType = "forex" | "synthetic" | "crypto";
export type TradeDirection = "buy" | "sell";
export type TradeKind = "executed" | "missed";
export type TradeSession = "London" | "NY" | "Asia";
export type ExecutionType = "controlled" | "emotional";

export type MissedReason =
  | "hesitation"
  | "fear"
  | "lack_of_confidence"
  | "distraction";

export interface Trade {
  id: string;
  userId: string;
  source: TradeSource;

  asset: string;
  marketType: MarketType | null;

  direction: TradeDirection;

  // Price / sizing — only required on executed trades
  entryPrice: number | null;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number | null;
  riskR: number | null;

  // Outcome — executed trades
  resultR: number | null;
  pnl: number | null;

  session: TradeSession | null;

  screenshotUrl: string | null;
  notes: string | null;

  // Executed vs Missed
  tradeType: TradeKind;

  // Missed-trade specific
  missedPotentialR: number | null;
  missedReason: MissedReason | null;

  // Rule adherence
  rulesFollowed: string[];
  rulesBroken: string[];

  executionType: ExecutionType | null;

  createdAt: string; // ISO
  closedAt: string | null; // ISO
}

/**
 * Empty/default Trade — useful as a starting point for forms.
 */
export const emptyTrade = (
  partial: Partial<Trade> & Pick<Trade, "userId">,
): Trade => ({
  id: crypto.randomUUID(),
  source: "manual",
  asset: "",
  marketType: null,
  direction: "buy",
  entryPrice: null,
  exitPrice: null,
  stopLoss: null,
  takeProfit: null,
  lotSize: null,
  riskR: null,
  resultR: null,
  pnl: null,
  session: null,
  screenshotUrl: null,
  notes: null,
  tradeType: "executed",
  missedPotentialR: null,
  missedReason: null,
  rulesFollowed: [],
  rulesBroken: [],
  executionType: null,
  createdAt: new Date().toISOString(),
  closedAt: null,
  ...partial,
});

export const MISSED_REASON_LABELS: Record<MissedReason, string> = {
  hesitation: "Hesitation",
  fear: "Fear",
  lack_of_confidence: "Lack of confidence",
  distraction: "Distraction",
};
