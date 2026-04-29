// TradeHistory — list of journal_entries with thumbnails, classification,
// score impact. Fullscreen screenshot preview on tap.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, ImageOff, X } from "lucide-react";
import { useBehavioralJournal } from "@/hooks/useBehavioralJournal";
import {
  MISTAKE_LABEL,
  getScreenshotUrl,
  type Classification,
  type JournalEntry,
} from "@/lib/behavioralJournal";

const ease = [0.22, 1, 0.36, 1] as const;

const CLASS_TONE: Record<Classification, { label: string; chip: string; tone: string }> = {
  clean:  { label: "Clean",  chip: "bg-emerald-500/10 ring-emerald-500/20 text-emerald-300", tone: "text-emerald-300" },
  minor:  { label: "Minor",  chip: "bg-amber-500/10 ring-amber-500/20 text-amber-300",       tone: "text-amber-300" },
  bad:    { label: "Bad",    chip: "bg-orange-500/10 ring-orange-500/20 text-orange-300",    tone: "text-orange-300" },
  severe: { label: "Severe", chip: "bg-rose-500/10 ring-rose-500/20 text-rose-300",          tone: "text-rose-300" },
};

function fmtR(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TradeHistory() {
  const { entries, score, loading } = useBehavioralJournal(100);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-50" />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-8 pb-24">
        <header className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70 hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            History
          </span>
        </header>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">
              Trade history
            </h1>
            <p className="mt-1 text-[12.5px] text-text-secondary">
              {loading ? "Loading…" : `${entries.length} trades · score ${score}/100`}
            </p>
          </div>
          <Link
            to="/hub/journal"
            className="rounded-full bg-primary/15 ring-1 ring-primary/30 px-3.5 py-2 text-[11.5px] font-semibold text-text-primary active:scale-[0.98] transition"
          >
            Log trade
          </Link>
        </div>

        {!loading && entries.length === 0 && (
          <div className="mt-12 rounded-2xl bg-card ring-1 ring-border p-6 text-center">
            <p className="text-[13.5px] text-text-primary">No trades yet.</p>
            <p className="mt-1 text-[12px] text-text-secondary">
              Log your first trade to start tracking behavior.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {entries.map((e, i) => (
            <Item
              key={e.id}
              entry={e}
              delay={Math.min(i, 6) * 0.04}
              onPreview={async (path) => {
                const url = await getScreenshotUrl(path);
                if (url) setPreviewUrl(url);
              }}
            />
          ))}
        </div>
      </div>

      {previewUrl && (
        <button
          type="button"
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
        >
          <X className="absolute right-5 top-5 h-6 w-6 text-white/80" />
          <img
            src={previewUrl}
            alt="Trade screenshot"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
          />
        </button>
      )}
    </div>
  );
}

function Item({
  entry,
  delay,
  onPreview,
}: {
  entry: JournalEntry;
  delay: number;
  onPreview: (path: string) => void;
}) {
  const ct = CLASS_TONE[entry.classification];
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (entry.screenshot_path) {
      getScreenshotUrl(entry.screenshot_path).then((u) => {
        if (!cancelled) setThumb(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [entry.screenshot_path]);

  const mistakesText = useMemo(() => {
    if (entry.mistakes.length === 0) return null;
    return entry.mistakes.map((m) => MISTAKE_LABEL[m]).join(" · ");
  }, [entry.mistakes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease, delay }}
      className="rounded-2xl bg-card ring-1 ring-border p-4"
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <button
          type="button"
          onClick={() => entry.screenshot_path && onPreview(entry.screenshot_path)}
          disabled={!entry.screenshot_path}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-background/60 ring-1 ring-border flex items-center justify-center"
        >
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-4 w-4 text-text-secondary/50" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-text-primary">
              {entry.asset}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ring-1 ${ct.chip}`}
            >
              {ct.label}
            </span>
          </div>
          <p className="mt-0.5 text-[10.5px] text-text-secondary/70">
            {fmtTime(entry.created_at)}
          </p>
          {mistakesText && (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] text-text-secondary/80">
              {mistakesText}
            </p>
          )}
          {entry.note && (
            <p className="mt-1 line-clamp-2 text-[11.5px] italic text-text-secondary/65">
              "{entry.note}"
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-[14px] font-semibold tabular-nums ${entry.result_r >= 0 ? "text-emerald-300" : "text-rose-300"}`}
          >
            {fmtR(entry.result_r)}
          </p>
          <p className={`mt-1 text-[12px] font-semibold tabular-nums ${ct.tone}`}>
            {entry.score_delta > 0 ? "+" : ""}
            {entry.score_delta}
          </p>
          <p className="mt-0.5 text-[9.5px] uppercase tracking-wider text-text-secondary/55 tabular-nums">
            {entry.score_before}→{entry.score_after}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
