// tradeLogTopBar — tiny pub/sub used by the trade-logging flow to tell the
// HubLayout top bar which step is active. Pure UI state, no persistence.

const TOTAL_STEPS = 4;
const EVT = "seneca:trade-log-step";

let current: { step: number; total: number } | null = null;

export function setTradeLogStep(step: number, total = TOTAL_STEPS) {
  current = { step, total };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT, { detail: current }));
  }
}

export function clearTradeLogStep() {
  current = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT, { detail: null }));
  }
}

export function getTradeLogStep() {
  return current;
}

export function subscribeTradeLogStep(
  cb: (s: { step: number; total: number } | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    cb((e as CustomEvent).detail ?? null);
  };
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
