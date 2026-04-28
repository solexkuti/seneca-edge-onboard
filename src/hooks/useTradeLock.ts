// useTradeLock — subscribes to lock state and refreshes on:
//   - mount
//   - focus / online
//   - JOURNAL_EVENT (new trade logged)
//   - TRADE_LOCK_EVENT (manual broadcast from confirmation flow)
//   - midnight rollover (new day → re-lock)

import { useEffect, useState, useCallback } from "react";
import { fetchTradeLockState, TRADE_LOCK_EVENT, type TradeLockState } from "@/lib/tradeLock";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";

export function useTradeLock() {
  const [state, setState] = useState<TradeLockState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await fetchTradeLockState();
    setState(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    const onChange = () => void refresh();
    window.addEventListener(TRADE_LOCK_EVENT, onChange);
    window.addEventListener(JOURNAL_EVENT, onChange);
    window.addEventListener("focus", onChange);
    window.addEventListener("online", onChange);

    // Midnight rollover — re-evaluate when the calendar day flips.
    const now = new Date();
    const msToMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
      now.getTime() +
      1000;
    const t = window.setTimeout(onChange, msToMidnight);

    return () => {
      window.removeEventListener(TRADE_LOCK_EVENT, onChange);
      window.removeEventListener(JOURNAL_EVENT, onChange);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("online", onChange);
      window.clearTimeout(t);
    };
  }, [refresh]);

  return { state, loading, refresh };
}
