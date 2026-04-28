// React provider/hook for TRADER_STATE.
// Mounted once at the root so every module reads from the same instance.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EMPTY_STATE,
  loadTraderState,
  onAuthChange,
  onTraderStateChange,
  type TraderState,
} from "@/lib/traderState";

type Ctx = {
  state: TraderState;
  refresh: () => Promise<void>;
};

const TraderStateCtx = createContext<Ctx | null>(null);

export function TraderStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TraderState>(EMPTY_STATE);
  const inflightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const next = await loadTraderState();
      setState(next);
    } catch (e) {
      console.error("[trader-state] load failed:", e);
      setState((s) => ({ ...s, loading: false }));
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsubEvents = onTraderStateChange(() => void refresh());
    const unsubAuth = onAuthChange(() => void refresh());
    return () => {
      unsubEvents();
      unsubAuth();
    };
  }, [refresh]);

  const value = useMemo(() => ({ state, refresh }), [state, refresh]);
  return (
    <TraderStateCtx.Provider value={value}>{children}</TraderStateCtx.Provider>
  );
}

export function useTraderState(): Ctx {
  const ctx = useContext(TraderStateCtx);
  if (!ctx) {
    throw new Error("useTraderState must be used inside <TraderStateProvider>");
  }
  return ctx;
}
