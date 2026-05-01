// MissedTradeFlow — log a setup you SAW but did NOT take.
//
// Missed trades are first-class citizens in Seneca Edge: they expose
// hesitation, fear, and confidence gaps. Persisted to the same `trades`
// table with `trade_type = 'missed'` so analysis can compare executed
// vs missed performance side-by-side.
//
// Calm dark-gold UI. Single-screen, deliberately minimal — the cost of
// missing a trade is friction, so logging it must be effortless.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Eye,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  MISSED_REASON_LABELS,
  type MissedReason,
  type TradeDirection,
  type MarketType,
} from "@/lib/trade/types";
import { sessionFromTimestamp, inferMarketType } from "@/lib/trade/normalize";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";

const ease = [0.22, 1, 0.36, 1] as const;

const REASONS: { id: MissedReason; label: string; hint: string }[] = [
  { id: "hesitation", label: MISSED_REASON_LABELS.hesitation, hint: "Setup was clear, you froze." },
  { id: "fear", label: MISSED_REASON_LABELS.fear, hint: "Recent loss made you flinch." },
  {
    id: "lack_of_confidence",
    label: MISSED_REASON_LABELS.lack_of_confidence,
    hint: "Doubted your own read.",
  },
  { id: "distraction", label: MISSED_REASON_LABELS.distraction, hint: "Eyes off the chart." },
];

export default function MissedTradeFlow({ onLogged }: { onLogged?: () => void }) {
  const [asset, setAsset] = useState("");
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [potentialRStr, setPotentialRStr] = useState("");
  const [reason, setReason] = useState<MissedReason | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const potentialR = useMemo(() => {
    const t = potentialRStr.replace(/[+rR\s]/g, "");
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [potentialRStr]);

  const canSubmit =
    asset.trim().length > 0 && reason !== null && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        toast.error("Sign in to log missed trades.");
        setSubmitting(false);
        return;
      }
      const now = new Date();
      const marketType: MarketType = inferMarketType(asset);
      const session = sessionFromTimestamp(now.getTime());

      const { error } = await supabase.from("trades").insert({
        user_id: userId,
        source: "manual",
        market: asset.trim(),
        market_type: marketType,
        asset: asset.trim(),
        direction: direction === "buy" ? "long" : "short",
        trade_type: "missed",
        missed_potential_r: potentialR,
        missed_reason: reason,
        session,
        notes: notes.trim() || null,
        rules_followed: [],
        rules_broken: [],
        executed_at: now.toISOString(),
      });

      if (error) throw error;

      toast.success("Missed trade logged. Honesty compounds.");
      window.dispatchEvent(new CustomEvent(JOURNAL_EVENT));
      setDone(true);
      onLogged?.();
    } catch (e) {
      console.error(e);
      toast.error("Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setAsset("");
    setDirection("buy");
    setPotentialRStr("");
    setReason(null);
    setNotes("");
    setDone(false);
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="rounded-2xl border border-[#C6A15B]/30 bg-[#18181A] p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#C6A15B]/15 text-[#E7C98A]">
          <Eye className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-2xl text-[#EDEDED]">
          Logged. The setup is captured.
        </h2>
        <p className="mt-2 text-sm text-[#9A9A9A]">
          Missed trades teach you where hesitation lives. Review them in
          History to surface the pattern.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-[#C6A15B] px-5 py-2.5 text-sm font-medium text-[#0B0B0D] hover:bg-[#E7C98A] transition-colors"
        >
          Log another
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="space-y-6"
    >
      <div className="rounded-2xl border border-[#C6A15B]/20 bg-[#18181A]/60 p-5">
        <div className="flex items-center gap-2 text-[#E7C98A]">
          <Eye className="h-4 w-4" />
          <span className="text-xs uppercase tracking-[0.2em]">Missed Trade</span>
        </div>
        <p className="mt-2 text-sm text-[#9A9A9A]">
          You saw the setup. You didn't take it. Capture why — that's the data
          that exposes hesitation.
        </p>
      </div>

      {/* Asset + direction */}
      <div className="rounded-2xl border border-white/5 bg-[#18181A] p-5 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-[#9A9A9A]">
            Asset / Pair
          </span>
          <input
            type="text"
            value={asset}
            onChange={(e) => setAsset(e.target.value.toUpperCase())}
            placeholder="EURUSD, BTCUSD, BOOM1000…"
            className="mt-2 w-full rounded-lg bg-[#0B0B0D] border border-white/10 px-3 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#5A5A5A] focus:border-[#C6A15B]/50 focus:outline-none transition-colors"
          />
        </label>

        <div>
          <span className="text-xs uppercase tracking-[0.18em] text-[#9A9A9A]">
            Direction you saw
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["buy", "sell"] as TradeDirection[]).map((d) => {
              const active = direction === d;
              const Icon = d === "buy" ? TrendingUp : TrendingDown;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-[#C6A15B]/50 bg-[#C6A15B]/10 text-[#E7C98A]"
                      : "border-white/10 bg-[#0B0B0D] text-[#9A9A9A] hover:border-white/20"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {d === "buy" ? "Long" : "Short"}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-[#9A9A9A] flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            Potential R missed <span className="text-[#5A5A5A] normal-case">(optional)</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={potentialRStr}
            onChange={(e) => setPotentialRStr(e.target.value)}
            placeholder="e.g. 2.5"
            className="mt-2 w-full rounded-lg bg-[#0B0B0D] border border-white/10 px-3 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#5A5A5A] focus:border-[#C6A15B]/50 focus:outline-none transition-colors"
          />
          <p className="mt-1.5 text-[11px] text-[#5A5A5A]">
            What the trade would have paid if you had taken it.
          </p>
        </label>
      </div>

      {/* Reason */}
      <div className="rounded-2xl border border-white/5 bg-[#18181A] p-5">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#C6A15B]" />
          <span className="text-xs uppercase tracking-[0.18em] text-[#9A9A9A]">
            Why didn't you take it?
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {REASONS.map((r) => {
            const active = reason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className={`text-left rounded-lg border px-3.5 py-3 transition-colors ${
                  active
                    ? "border-[#C6A15B]/50 bg-[#C6A15B]/10"
                    : "border-white/10 bg-[#0B0B0D] hover:border-white/20"
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    active ? "text-[#E7C98A]" : "text-[#EDEDED]"
                  }`}
                >
                  {r.label}
                </div>
                <div className="mt-0.5 text-[11px] text-[#9A9A9A]">{r.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-white/5 bg-[#18181A] p-5">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-[#9A9A9A] flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            What was happening? <span className="text-[#5A5A5A] normal-case">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="State, market context, what stopped you…"
            rows={3}
            className="mt-2 w-full rounded-lg bg-[#0B0B0D] border border-white/10 px-3 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#5A5A5A] focus:border-[#C6A15B]/50 focus:outline-none transition-colors resize-none"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-gold w-full flex items-center justify-center gap-2 rounded-lg bg-[#C6A15B] px-5 py-3 text-sm font-medium text-[#0B0B0D] hover:bg-[#E7C98A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            Log missed trade
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </motion.div>
  );
}
