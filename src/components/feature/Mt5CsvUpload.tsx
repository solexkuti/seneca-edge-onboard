// Mt5CsvUpload — manual upload flow for MT5 closed-deal history.
//
// Pro-only feature. The user drops in their MT5 history export (.csv), we:
//   1. Parse rows tolerantly (parseMt5Csv)
//   2. De-dupe against existing trades by (user_id, source, broker_deal_id)
//   3. Insert via the unified Trade pipeline (tradeFromMt5 → tradeToInsert)
//   4. Log the import to `mt5_imports` so behavioral nudges can fire
//   5. Show a success state that introduces automation (Premium upsell)
//
// Design intent: manual upload should feel temporary and slightly tedious —
// the friction is the message. Automation is the natural next step.

import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  Lock,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseMt5Csv } from "@/lib/trade/mt5Csv";
import { tradeFromMt5, tradeToInsert } from "@/lib/trade/normalize";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";

const ease = [0.22, 1, 0.36, 1] as const;

type Phase = "idle" | "parsing" | "importing" | "success" | "error";

interface ImportSummary {
  imported: number;
  duplicate: number;
  skipped: number;
  total: number;
  latestDealAt: string | null;
  filename: string;
}

export function Mt5CsvUpload() {
  const { isPro, loading: tierLoading } = useSubscriptionTier();
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------- Pro gate ----------
  if (!tierLoading && !isPro) {
    return <ProUpsellCard />;
  }

  async function handleFile(file: File) {
    setError(null);
    setPhase("parsing");

    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      setError("Couldn't read the file. Try saving it as plain CSV from MT5.");
      setPhase("error");
      return;
    }

    const parsed = parseMt5Csv(text);
    if (parsed.deals.length === 0) {
      setError(
        parsed.totalRows === 0
          ? "No rows detected. Export 'History' from MT5 as CSV (or copy from the Statement tab)."
          : `Couldn't recognise the columns in this file. Make sure it's an MT5 history export, not a positions snapshot.`,
      );
      setPhase("error");
      return;
    }

    setPhase("importing");

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setError("You need to be signed in to import trades.");
      setPhase("error");
      return;
    }

    // Dedup: fetch existing broker_deal_ids for this user + mt5
    const { data: existing, error: existingErr } = await supabase
      .from("trades")
      .select("broker_deal_id")
      .eq("user_id", uid)
      .eq("source", "mt5")
      .not("broker_deal_id", "is", null);

    if (existingErr) {
      setError("Couldn't check existing trades. Try again in a moment.");
      setPhase("error");
      return;
    }

    const knownTickets = new Set(
      (existing ?? [])
        .map((r) => (r as { broker_deal_id: string | null }).broker_deal_id)
        .filter(Boolean) as string[],
    );

    let imported = 0;
    let duplicate = 0;
    let latestMs = 0;

    // Build insert rows for new tickets only
    const toInsert: ReturnType<typeof tradeToInsert>[] = [];
    for (const deal of parsed.deals) {
      const ticket = String(deal.ticket);
      if (knownTickets.has(ticket)) {
        duplicate++;
        continue;
      }
      const trade = tradeFromMt5(deal, uid);
      // Attach the broker_deal_id manually (our Trade type doesn't carry it,
      // but the DB row does). We append via Object spread on insert payload.
      const row = { ...tradeToInsert(trade), broker_deal_id: ticket };
      toInsert.push(row as ReturnType<typeof tradeToInsert>);
      const t = new Date(deal.openTime).getTime();
      if (t > latestMs) latestMs = t;
      imported++;
    }

    // Insert in chunks of 200 to stay under PostgREST limits
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 200) {
        const chunk = toInsert.slice(i, i + 200);
        const { error: insertErr } = await supabase
          .from("trades")
          .insert(chunk);
        if (insertErr) {
          // 23505 = unique violation, treat as duplicate (race with concurrent import)
          if (insertErr.code === "23505") {
            duplicate += chunk.length;
            imported -= chunk.length;
            continue;
          }
          console.error("[mt5-upload] insert failed", insertErr);
          setError(
            `Imported ${imported} of ${parsed.deals.length} trades, then hit an error. ${insertErr.message ?? ""}`,
          );
          setPhase("error");
          return;
        }
      }
    }

    // Log the import for behavioral nudges
    await supabase.from("mt5_imports").insert({
      user_id: uid,
      filename: file.name,
      rows_total: parsed.totalRows,
      rows_imported: imported,
      rows_duplicate: duplicate,
      rows_skipped: parsed.skippedRows,
      latest_deal_at: latestMs ? new Date(latestMs).toISOString() : null,
    });

    // Notify journal listeners (TradeHistory, Breakdown, etc.)
    window.dispatchEvent(new CustomEvent(JOURNAL_EVENT));

    setSummary({
      imported,
      duplicate,
      skipped: parsed.skippedRows,
      total: parsed.totalRows,
      latestDealAt: latestMs ? new Date(latestMs).toISOString() : null,
      filename: file.name,
    });
    setPhase("success");
  }

  function reset() {
    setSummary(null);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {phase === "idle" || phase === "parsing" || phase === "importing" ? (
          <DropZone
            key="drop"
            phase={phase}
            inputRef={inputRef}
            onPick={(f) => handleFile(f)}
          />
        ) : phase === "error" ? (
          <ErrorCard key="err" message={error} onRetry={reset} />
        ) : phase === "success" && summary ? (
          <SuccessCard key="ok" summary={summary} onAnother={reset} />
        ) : null}
      </AnimatePresence>

      <ManualLimitsCallout />
    </div>
  );
}

// ───────── Sub-components ─────────

function DropZone({
  phase,
  inputRef,
  onPick,
}: {
  phase: Phase;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const busy = phase === "parsing" || phase === "importing";

  return (
    <motion.label
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (busy) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      htmlFor="mt5-csv-input"
      className={`block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver
          ? "border-[#C6A15B] bg-[#C6A15B]/5"
          : "border-white/10 bg-[#18181A] hover:border-[#C6A15B]/40"
      } ${busy ? "pointer-events-none opacity-80" : ""}`}
    >
      <input
        ref={inputRef}
        id="mt5-csv-input"
        type="file"
        accept=".csv,.txt,text/csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
        disabled={busy}
      />
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#C6A15B]/10 ring-1 ring-[#C6A15B]/25">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#E7C98A]" />
        ) : (
          <UploadCloud className="h-5 w-5 text-[#E7C98A]" />
        )}
      </div>
      <p className="mt-4 font-serif text-[18px] tracking-tight text-[#EDEDED]">
        {phase === "parsing"
          ? "Reading your history…"
          : phase === "importing"
            ? "Importing trades…"
            : "Drop your MT5 CSV here"}
      </p>
      <p className="mt-1.5 text-[12px] text-[#9A9A9A]">
        {busy
          ? "Hold on — analysing every closed deal."
          : "Or click to choose. Max 20MB, plain CSV from MT5 history."}
      </p>
      {!busy && (
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#C6A15B] px-4 py-2 text-[12.5px] font-medium text-[#0B0B0D]">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Choose file
        </div>
      )}
    </motion.label>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease }}
      className="rounded-2xl border border-rose-500/25 bg-[#1A1213] p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
        <div className="flex-1">
          <p className="font-serif text-[16px] tracking-tight text-[#EDEDED]">
            That didn't work
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9A9A9A]">
            {message ?? "Something went wrong. Try a fresh export."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3.5 py-2 text-[12px] font-medium text-[#EDEDED] hover:bg-white/[0.08]"
          >
            <X className="h-3.5 w-3.5" /> Try another file
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SuccessCard({
  summary,
  onAnother,
}: {
  summary: ImportSummary;
  onAnother: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
      className="overflow-hidden rounded-2xl border border-[#C6A15B]/25 bg-gradient-to-br from-[#1A1612] via-[#18181A] to-[#18181A]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          </div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-emerald-300">
            Import complete
          </p>
        </div>

        <h2 className="mt-3 font-serif text-[24px] tracking-tight text-[#EDEDED]">
          {summary.imported} {summary.imported === 1 ? "trade" : "trades"} added
        </h2>
        <p className="mt-1 text-[12.5px] text-[#9A9A9A]">
          From <span className="text-[#EDEDED]/85">{summary.filename}</span>
          {summary.duplicate > 0 && (
            <>
              {" "}
              · {summary.duplicate} already in your journal
            </>
          )}
          {summary.skipped > 0 && <> · {summary.skipped} skipped</>}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Tile label="Imported" value={summary.imported} tone="gold" />
          <Tile label="Duplicates" value={summary.duplicate} />
          <Tile label="Skipped" value={summary.skipped} />
        </div>
      </div>

      {/* Automation upsell — the real point of the success state */}
      <div className="border-t border-[#C6A15B]/15 bg-[#0F0F11] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C6A15B]/15 ring-1 ring-[#C6A15B]/30">
            <Sparkles className="h-4 w-4 text-[#E7C98A]" />
          </div>
          <div className="flex-1">
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-[#C6A15B]">
              The natural next step
            </p>
            <h3 className="mt-1 font-serif text-[18px] tracking-tight text-[#EDEDED]">
              Stop uploading. Let Seneca pull every deal in real-time.
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9A9A9A]">
              Manual works — but every trade you forget to import is a blind
              spot in your behavior score. Premium connects directly to your
              MT5 account so closed deals land in your journal the moment they
              happen.
            </p>
            <ul className="mt-3 space-y-1.5 text-[12px] text-[#EDEDED]/80">
              <Bullet>Real-time sync — no more weekly exports</Bullet>
              <Bullet>Multi-account — funded + personal, side by side</Bullet>
              <Bullet>Automatic session and asset tagging</Bullet>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/hub/connections/automate"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#C6A15B] px-4 py-2.5 text-[12.5px] font-semibold text-[#0B0B0D] shadow-[0_0_25px_rgba(198,161,91,0.25)] transition-colors hover:bg-[#E7C98A]"
              >
                See automation options
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={onAnother}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-4 py-2.5 text-[12.5px] font-medium text-[#9A9A9A] hover:bg-white/[0.07] hover:text-[#EDEDED]"
              >
                Upload another file
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Tile({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "gold" | "muted";
}) {
  return (
    <div className="rounded-xl bg-[#0F0F11] ring-1 ring-white/5 px-3 py-2.5">
      <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
        {label}
      </p>
      <p
        className={`mt-1 font-serif text-[22px] leading-none tabular-nums ${
          tone === "gold" ? "text-[#E7C98A]" : "text-[#EDEDED]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C6A15B]" />
      <span>{children}</span>
    </li>
  );
}

function ManualLimitsCallout() {
  return (
    <div className="rounded-xl bg-[#18181A] ring-1 ring-white/[0.06] p-4">
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[#9A9A9A]/70">
        How to export from MT5
      </p>
      <ol className="mt-2 space-y-1 text-[12px] leading-relaxed text-[#9A9A9A]">
        <li>1. Open the Toolbox panel → History tab.</li>
        <li>2. Right-click → Period → All History.</li>
        <li>3. Right-click → Report → Save as CSV.</li>
      </ol>
    </div>
  );
}

// ───────── Free-tier upsell ─────────

function ProUpsellCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="rounded-2xl border border-[#C6A15B]/25 bg-[#18181A] p-6 sm:p-8 text-center"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#C6A15B]/10 ring-1 ring-[#C6A15B]/30">
        <Lock className="h-5 w-5 text-[#E7C98A]" />
      </div>
      <h2 className="mt-4 font-serif text-[22px] tracking-tight text-[#EDEDED]">
        Manual MT5 import is a Pro feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[#9A9A9A]">
        Pro unlocks bulk CSV upload from any MT5 broker so Seneca can score
        every trade you've actually taken — not just the ones you remember to
        log.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/hub/billing"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#C6A15B] px-4 py-2.5 text-[12.5px] font-semibold text-[#0B0B0D] shadow-[0_0_25px_rgba(198,161,91,0.25)] hover:bg-[#E7C98A]"
        >
          Upgrade to Pro
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/hub/connections"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-4 py-2.5 text-[12.5px] font-medium text-[#9A9A9A] hover:bg-white/[0.07] hover:text-[#EDEDED]"
        >
          Back to connections
        </Link>
      </div>
    </motion.div>
  );
}
