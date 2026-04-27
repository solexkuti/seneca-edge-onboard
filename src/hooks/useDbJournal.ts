// React hook that subscribes to the DB-backed Trading Journal and exposes
// entries in the legacy `JournalEntry` shape so existing helpers
// (computeDiscipline, detectBehaviorPattern, summarizeJournal) just work.
//
// Re-fetches on:
// - mount
// - any local journal-update event (after a submission in this tab)
// - auth state changes (sign-in / sign-out)

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchJournal,
  toLegacyEntries,
  type DbJournalRow,
} from "@/lib/dbJournal";
import { JOURNAL_EVENT, type JournalEntry } from "@/lib/tradingJournal";

export function useDbJournal(): {
  rows: DbJournalRow[];
  entries: JournalEntry[];
  loading: boolean;
  refresh: () => void;
} {
  const [rows, setRows] = useState<DbJournalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetchJournal()
      .then((r) => setRows(r))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();

    const onUpdate = () => refresh();
    window.addEventListener(JOURNAL_EVENT, onUpdate);

    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());

    return () => {
      window.removeEventListener(JOURNAL_EVENT, onUpdate);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rows, entries: toLegacyEntries(rows), loading, refresh };
}
