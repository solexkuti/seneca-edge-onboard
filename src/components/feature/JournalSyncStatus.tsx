import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import {
  isSyncingNow,
  listPending,
  subscribePending,
} from "@/lib/journalPendingQueue";

/**
 * Subtle pill that surfaces the background sync state of the journal queue.
 *   - Hidden when the queue is empty.
 *   - "Syncing…" while a flush is actively running.
 *   - "Saved locally · N" when entries are queued but no flush is in flight.
 */
export default function JournalSyncStatus({
  className = "",
}: {
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const refresh = () => {
      setCount(listPending().length);
      setSyncing(isSyncingNow());
    };
    refresh();
    const unsub = subscribePending(refresh);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const visible = count > 0 || syncing;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="journal-sync-status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-text-secondary backdrop-blur ${className}`}
        >
          {syncing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-text-secondary" strokeWidth={2.4} />
              Syncing…
            </>
          ) : !online ? (
            <>
              <CloudOff className="h-3 w-3 text-text-secondary" strokeWidth={2.4} />
              Saved locally · {count}
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3 text-text-secondary" strokeWidth={2.4} />
              Saved locally · {count}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
