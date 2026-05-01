// ViolationDetailModal — open any rule violation, see every affected trade,
// and annotate each one with personal notes scoped to that specific rule.
//
// Notes are persisted in `public.trade_annotations` keyed on (trade_id, rule)
// so the same trade can carry different annotations under different rules.
// Pure intelligence surface — no enforcement, just reflection.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Check,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RuleViolationRow, Trade } from "@/lib/trade";

const ease = [0.22, 1, 0.36, 1] as const;

interface AnnotationRow {
  id: string;
  trade_id: string;
  rule: string;
  note: string;
  updated_at: string;
}

function fmtR(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}R`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ViolationDetailModal({
  violation,
  open,
  onClose,
}: {
  violation: RuleViolationRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const tradeIds = useMemo(
    () => violation?.trades.map((t) => t.id) ?? [],
    [violation],
  );

  // Load existing annotations for this rule + these trades
  useEffect(() => {
    if (!open || !violation || tradeIds.length === 0) {
      setNotes({});
      setSavedNotes({});
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId || !violation) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("trade_annotations")
        .select("id, trade_id, rule, note, updated_at")
        .eq("user_id", userId)
        .eq("rule", violation.rule)
        .in("trade_id", tradeIds);
      if (cancelled) return;
      if (error) {
        console.error("[annotations] load failed", error);
      }
      const map: Record<string, string> = {};
      for (const row of (data as AnnotationRow[] | null) ?? []) {
        map[row.trade_id] = row.note;
      }
      setNotes(map);
      setSavedNotes(map);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, violation, tradeIds]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function saveNote(trade: Trade) {
    if (!violation) return;
    const note = (notes[trade.id] ?? "").trim();
    setSavingId(trade.id);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setSavingId(null);
      return;
    }

    if (note.length === 0) {
      // Empty → delete the annotation if it exists
      await supabase
        .from("trade_annotations")
        .delete()
        .eq("user_id", userId)
        .eq("trade_id", trade.id)
        .eq("rule", violation.rule);
      setSavedNotes((s) => {
        const next = { ...s };
        delete next[trade.id];
        return next;
      });
      setNotes((s) => {
        const next = { ...s };
        delete next[trade.id];
        return next;
      });
    } else {
      const { error } = await supabase.from("trade_annotations").upsert(
        {
          user_id: userId,
          trade_id: trade.id,
          rule: violation.rule,
          note,
        },
        { onConflict: "user_id,trade_id,rule" },
      );
      if (error) {
        console.error("[annotations] save failed", error);
      } else {
        setSavedNotes((s) => ({ ...s, [trade.id]: note }));
      }
    }
    setSavingId(null);
  }

  return (
    <AnimatePresence>
      {open && violation && (
        <motion.div
          key="vd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
          onClick={onClose}
          className="fixed inset-0 z-[80] bg-[#0B0B0D]/85 backdrop-blur-sm flex items-end sm:items-center justify-center"
        >
          <motion.div
            key="vd-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-[680px] max-h-[92svh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#18181A] ring-1 ring-white/10 shadow-2xl"
          >
            {/* Header */}
            <header className="sticky top-0 z-10 bg-[#18181A]/95 backdrop-blur-sm border-b border-white/[0.06] px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9A9A9A]">
                  Rule violation
                </p>
                <h2 className="mt-1 font-serif text-[18px] leading-tight text-[#EDEDED] truncate">
                  {violation.rule}
                </h2>
                <p className="mt-1 text-[11.5px] text-[#9A9A9A] tabular-nums">
                  Broken {violation.timesBroken}× · Impact{" "}
                  <span
                    className={
                      violation.totalImpactR < 0
                        ? "text-rose-400"
                        : violation.totalImpactR > 0
                          ? "text-[#E7C98A]"
                          : ""
                    }
                  >
                    {fmtR(violation.totalImpactR)}
                  </span>{" "}
                  · Last {fmtRelative(violation.lastBrokenAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-lg p-1.5 text-[#9A9A9A] hover:text-[#EDEDED] hover:bg-white/[0.04] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Body */}
            <div className="px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/70 mb-3">
                Trades affected ({violation.trades.length}) · Annotate each one
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-10 text-[#9A9A9A]">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading
                  annotations…
                </div>
              ) : (
                <div className="space-y-3">
                  {violation.trades.map((trade) => (
                    <TradeAnnotationCard
                      key={trade.id}
                      trade={trade}
                      value={notes[trade.id] ?? ""}
                      saved={savedNotes[trade.id] ?? ""}
                      saving={savingId === trade.id}
                      onChange={(v) =>
                        setNotes((s) => ({ ...s, [trade.id]: v }))
                      }
                      onSave={() => saveNote(trade)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TradeAnnotationCard({
  trade,
  value,
  saved,
  saving,
  onChange,
  onSave,
}: {
  trade: Trade;
  value: string;
  saved: string;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const Icon = trade.direction === "buy" ? TrendingUp : TrendingDown;
  const dirty = value.trim() !== saved.trim();
  const hasNote = (saved ?? "").trim().length > 0;

  useEffect(() => {
    if (editing) taRef.current?.focus();
  }, [editing]);

  return (
    <div className="rounded-xl bg-[#0B0B0D]/60 ring-1 ring-white/[0.06] p-3.5">
      {/* Trade header line */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            className={`h-3.5 w-3.5 shrink-0 ${
              trade.direction === "buy" ? "text-[#E7C98A]" : "text-rose-400"
            }`}
          />
          <span className="text-[13px] font-medium text-[#EDEDED] truncate">
            {trade.asset}
          </span>
          <span className="text-[11px] text-[#9A9A9A]/80 shrink-0">
            · {fmtRelative(trade.createdAt)}
          </span>
          {trade.session && (
            <span className="text-[10px] uppercase tracking-wider text-[#9A9A9A]/70 shrink-0">
              · {trade.session}
            </span>
          )}
        </div>
        <span
          className={`text-[12px] tabular-nums shrink-0 ${
            (trade.resultR ?? 0) > 0
              ? "text-[#E7C98A]"
              : (trade.resultR ?? 0) < 0
                ? "text-rose-400"
                : "text-[#9A9A9A]"
          }`}
        >
          {fmtR(trade.resultR)}
        </span>
      </div>

      {/* Note area */}
      <div className="mt-2.5">
        {!editing && !hasNote ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-lg border border-dashed border-white/[0.08] bg-transparent px-3 py-2.5 text-left text-[12px] text-[#9A9A9A] hover:border-[#C6A15B]/40 hover:text-[#EDEDED] transition-colors"
          >
            + Add a note about this trade
          </button>
        ) : !editing && hasNote ? (
          <div className="group relative rounded-lg bg-white/[0.02] ring-1 ring-white/[0.05] px-3 py-2.5">
            <p className="text-[12.5px] leading-relaxed text-[#EDEDED]/90 whitespace-pre-wrap">
              {saved}
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-[#9A9A9A] hover:text-[#C6A15B] transition-colors"
            >
              <Pencil className="h-3 w-3" /> Edit note
            </button>
          </div>
        ) : (
          <div>
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What happened? What were you thinking? What will you do differently?"
              className="w-full resize-y rounded-lg bg-[#0B0B0D] ring-1 ring-white/[0.08] px-3 py-2.5 text-[12.5px] text-[#EDEDED] placeholder:text-[#9A9A9A]/60 focus:outline-none focus:ring-[#C6A15B]/40 transition-shadow"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-[#9A9A9A]/60 tabular-nums">
                {value.length}/1000
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange(saved);
                    setEditing(false);
                  }}
                  className="text-[11px] text-[#9A9A9A] hover:text-[#EDEDED] px-2 py-1 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !dirty}
                  onClick={async () => {
                    await onSave();
                    setEditing(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#C6A15B] px-3 py-1.5 text-[11.5px] font-medium text-[#0B0B0D] hover:bg-[#E7C98A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
