import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  isSyncingNow,
  listPending,
  retryNow,
  subscribePending,
} from "@/lib/journalPendingQueue";

/**
 * Subtle pill that surfaces the background sync state of the journal queue.
 *   - Hidden when the queue is empty.
 *   - "Syncing…" while a flush is actively running.
 *   - "Saved locally · N · Retry sync" when entries are queued.
 */
export default function JournalSyncStatus({
  className = "",
}: {
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const refresh = () => {
      const pending = listPending();
      const failed = pending.filter((entry) => entry.failedAt || (entry.attempts ?? 0) >= 3);
      setCount(pending.length);
      setFailedCount(failed.length);
      setLastError(failed.at(-1)?.lastError ?? null);
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

  const handleRetry = async () => {
    if (syncing) return;
    const before = count;
    const { remaining, synced } = await retryNow();
    if (synced > 0 && remaining === 0) {
      toast.success(synced === 1 ? "Trade synced." : `${synced} trades synced.`);
    } else if (synced > 0) {
      toast(`${synced} synced · ${remaining} still pending.`);
    } else if (before > 0) {
      toast.error("Sync failed — tap to retry", {
        description: listPending().find((entry) => entry.lastError)?.lastError,
      });
    }
  };

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
          className={`inline-flex max-w-[min(92vw,520px)] items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-text-secondary backdrop-blur ${className}`}
        >
          {syncing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-text-secondary" strokeWidth={2.4} />
              Syncing…
            </>
          ) : (
            <>
              {failedCount > 0 ? (
                <AlertCircle className="h-3 w-3 text-destructive" strokeWidth={2.4} />
              ) : online ? (
                <Cloud className="h-3 w-3 text-text-secondary" strokeWidth={2.4} />
              ) : (
                <CloudOff className="h-3 w-3 text-text-secondary" strokeWidth={2.4} />
              )}
              <span className="truncate">
                {failedCount > 0 ? "Sync failed — tap to retry" : `Saved locally · ${count}`}
                {lastError ? ` · ${lastError}` : ""}
              </span>
              <button
                type="button"
                onClick={handleRetry}
                disabled={syncing}
                className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-text-primary/80 transition hover:bg-text-primary/[0.06] hover:text-text-primary disabled:opacity-50"
                aria-label="Retry sync"
              >
                <RefreshCw className="h-3 w-3" strokeWidth={2.4} />
                Retry sync
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
