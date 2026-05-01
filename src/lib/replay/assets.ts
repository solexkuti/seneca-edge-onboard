// Asset catalog for the Replay engine.
//
// V1 ships Synthetic indices via Deriv only. The Forex group is intentionally
// included as a stub so the UI shape matches the long-term design — adding a
// Forex provider later means filling in `provider` and `symbol` and the rest
// of the system (datafeed, replay engine, simulator) doesn't change.

export type AssetCategory = "synthetic" | "forex";
export type DataProvider = "deriv" | "forex_stub";

export interface ReplayAsset {
  /** Internal id used for routing/state */
  id: string;
  /** Display label shown in the asset picker */
  label: string;
  /** Category grouping in the picker */
  category: AssetCategory;
  /** Which datafeed implementation services this asset */
  provider: DataProvider;
  /** Provider-native symbol (e.g. Deriv "R_75", "stpRNG", "BOOM500") */
  symbol: string;
  /** Whether the user can run a replay against it in v1 */
  enabled: boolean;
  /** Short subtitle */
  hint?: string;
}

export const ASSETS: ReplayAsset[] = [
  // --- Synthetic (Deriv) ---
  { id: "v75", label: "Volatility 75 Index", category: "synthetic", provider: "deriv", symbol: "R_75", enabled: true, hint: "High volatility · 24/7" },
  { id: "v100", label: "Volatility 100 Index", category: "synthetic", provider: "deriv", symbol: "R_100", enabled: true, hint: "Highest volatility · 24/7" },
  { id: "v50", label: "Volatility 50 Index", category: "synthetic", provider: "deriv", symbol: "R_50", enabled: true, hint: "Mid volatility · 24/7" },
  { id: "v25", label: "Volatility 25 Index", category: "synthetic", provider: "deriv", symbol: "R_25", enabled: true, hint: "Low volatility · 24/7" },
  { id: "step", label: "Step Index", category: "synthetic", provider: "deriv", symbol: "stpRNG", enabled: true, hint: "Constant step · 24/7" },
  { id: "boom500", label: "Boom 500", category: "synthetic", provider: "deriv", symbol: "BOOM500", enabled: true, hint: "Spike up market" },
  { id: "boom1000", label: "Boom 1000", category: "synthetic", provider: "deriv", symbol: "BOOM1000", enabled: true, hint: "Spike up market" },
  { id: "crash500", label: "Crash 500", category: "synthetic", provider: "deriv", symbol: "CRASH500", enabled: true, hint: "Spike down market" },
  { id: "crash1000", label: "Crash 1000", category: "synthetic", provider: "deriv", symbol: "CRASH1000", enabled: true, hint: "Spike down market" },

  // --- Forex (stubbed for v1) ---
  { id: "eurusd", label: "EUR / USD", category: "forex", provider: "forex_stub", symbol: "EURUSD", enabled: false, hint: "Coming soon" },
  { id: "gbpusd", label: "GBP / USD", category: "forex", provider: "forex_stub", symbol: "GBPUSD", enabled: false, hint: "Coming soon" },
  { id: "usdjpy", label: "USD / JPY", category: "forex", provider: "forex_stub", symbol: "USDJPY", enabled: false, hint: "Coming soon" },
];

export const TIMEFRAMES = [
  { id: "1m", label: "1m", seconds: 60 },
  { id: "5m", label: "5m", seconds: 300 },
  { id: "15m", label: "15m", seconds: 900 },
  { id: "1h", label: "1h", seconds: 3600 },
  { id: "4h", label: "4h", seconds: 14400 },
] as const;

export type TimeframeId = (typeof TIMEFRAMES)[number]["id"];

export function timeframeSeconds(tf: TimeframeId): number {
  return TIMEFRAMES.find((t) => t.id === tf)?.seconds ?? 60;
}

export function findAsset(id: string): ReplayAsset | undefined {
  return ASSETS.find((a) => a.id === id);
}

export function groupedAssets(): Record<AssetCategory, ReplayAsset[]> {
  return {
    synthetic: ASSETS.filter((a) => a.category === "synthetic"),
    forex: ASSETS.filter((a) => a.category === "forex"),
  };
}
