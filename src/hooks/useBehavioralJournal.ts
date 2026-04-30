// useBehavioralJournal — live view of journal_entries + overall avg score.
// Score is `null` when the user has 0 entries (system is "inactive").
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchEntries,
  getCurrentScore,
  type JournalEntry,
} from "@/lib/behavioralJournal";

export function useBehavioralJournal(limit = 50) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([fetchEntries(limit), getCurrentScore()]);
      setEntries(e);
      setScore(s);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data?.user) {
        setLoading(false);
        return;
      }
      await refresh();
    })();

    // Only refetch on actual identity changes — NOT on TOKEN_REFRESHED /
    // USER_UPDATED / INITIAL_SESSION, which Supabase fires often (tab focus,
    // background refresh) and would otherwise spam re-renders into any
    // consumer mid-interaction (e.g. the trade-logging form).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        refresh();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  return { entries, score, loading, refresh };
}
