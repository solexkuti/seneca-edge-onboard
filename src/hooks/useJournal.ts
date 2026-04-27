import { useEffect, useState } from "react";
import {
  JOURNAL_EVENT,
  readJournal,
  type JournalEntry,
} from "@/lib/tradingJournal";

// Subscribes to the trading journal store. Re-renders on updates from
// the same tab (custom event) and other tabs (storage event).
export function useJournal(): JournalEntry[] {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    setEntries(readJournal());

    const refresh = () => setEntries(readJournal());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "seneca_trading_journal") refresh();
    };

    window.addEventListener(JOURNAL_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(JOURNAL_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return entries;
}
