// Strict structured extraction shapes returned by the AI vision layer.
// The AI is REQUIRED to produce exactly this — nothing more, nothing less.
// Any free-form opinion is rejected at parse time.

export type ChartValidation = {
  is_chart: boolean;
  confidence: number; // 0..1
  detected_elements: {
    candlesticks: boolean;
    price_axis: boolean;
    time_axis: boolean;
  };
  reason?: string;
};

export type StructuredExtraction = {
  structure: {
    trend: "bullish" | "bearish" | "range";
    break_of_structure: boolean;
    liquidity_sweep: boolean;
  };
  levels: {
    fibonacci_detected: boolean;
    fib_zone: [number, number] | null;
    key_levels: number[];
  };
  price_action: {
    rejection: boolean;
    engulfing: boolean;
    consolidation: boolean;
  };
  /** Short, factual notes per observation — used as evidence strings. */
  notes?: Partial<{
    trend: string;
    break_of_structure: string;
    liquidity_sweep: string;
    fibonacci_detected: string;
    rejection: string;
    engulfing: string;
    consolidation: string;
  }>;
};

/** Combined two-timeframe extraction. */
export type DualExtraction = {
  execution: StructuredExtraction;
  higher: StructuredExtraction;
};

export const CHART_VALIDATION_THRESHOLD = 0.85;

export function passesChartGate(v: ChartValidation): boolean {
  return (
    v.is_chart === true &&
    v.confidence >= CHART_VALIDATION_THRESHOLD &&
    v.detected_elements.candlesticks === true &&
    v.detected_elements.price_axis === true &&
    v.detected_elements.time_axis === true
  );
}

export const CHART_REJECTION_MESSAGE =
  "This is not a valid trading chart. Upload a clear chart showing price action and axes.";
