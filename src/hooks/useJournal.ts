import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  JOURNAL_EVENT,
  readJournal as readLocalJournal,
  type JournalEntry,
} from "@/lib/tradingJournal";
import { fetchJournal, toLegacyEntries } from "@/lib/dbJournal";

export function useJournal(): JournalEntry[] {
  const [entries, setEntries] = useState<JournalEntry[]>(() => readLocalJournal());

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          // No session → fall back to legacy local entries
          if (!cancelled) setEntries(readLocalJournal());
          return;
        }
        const rows = await fetchJournal();
        if (!cancelled) {
          setEntries(rows.length ? toLegacyEntries(rows) : readLocalJournal());
        }
      } catch {
        if (!cancelled) setEntries(readLocalJournal());
      }
    };

    refresh();

    const onUpdate = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "seneca_trading_journal") refresh();
    };
    window.addEventListener(JOURNAL_EVENT, onUpdate);
    window.addEventListener("storage", onStorage);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refresh();
    });

    return () => {
      cancelled = true;
      window.removeEventListener(JOURNAL_EVENT, onUpdate);
      window.removeEventListener("storage", onStorage);
      sub.subscription.unsubscribe();
    };
  }, []);

  return entries;
}
