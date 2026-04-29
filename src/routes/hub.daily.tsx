// /hub/daily — Daily Checklist on the Seneca foundation.
//
// The checklist is the trader's morning commitment ritual. Seneca speaks
// one line, the rules are confirmed quietly, and a single primary action
// locks the day. No badges, no dashboards, no clutter.
//
// All underlying logic (generation, persistence, strict-mode, streaks,
// PDF export) is preserved — only the surface is rebuilt.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, Lock, RefreshCw } from "lucide-react";
import RequireAuth from "@/components/auth/RequireAuth";
import TraderStateGate from "@/components/feature/TraderStateGate";
import { supabase } from "@/integrations/supabase/client";
import { saveDailyChecklist } from "@/lib/dailyChecklistCache";
import {
  fetchTodayConfirmation,
  recordConfirmation,
  type RuleAck,
} from "@/lib/checklistConfirmation";
import { fetchDailyStreak } from "@/lib/dailyStreak";
import { toast } from "sonner";
import {
  SenecaScreen,
  SenecaHeader,
  MentorLine,
  PrimaryAction,
  SecondaryAction,
  FadeIn,
} from "@/components/seneca";
import { SenecaVoice } from "@/lib/senecaVoice";
import { useSenecaContext } from "@/hooks/useSenecaContext";

export const Route = createFileRoute("/hub/daily")({
  head: () => ({
    meta: [
      { title: "Daily Checklist — SenecaEdge" },
      {
        name: "description",
        content:
          "Confirm your rules. Lock the day. A calm pre-trade ritual built on your strategy and recent behavior.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <TraderStateGate
        surface="Daily Checklist"
        enforce={["no_strategy", "discipline_locked"]}
      >
        <DailyChecklistPage />
      </TraderStateGate>
    </RequireAuth>
  ),
});

type RuleEntry = {
  id: string;
  category: "entry" | "exit" | "risk" | "behavior" | "adaptive";
  label: string;
  weak: boolean;
};

type StreakInfo = {
  current: number;
  longest: number;
  identity: string;
  last_break_date: string | null;
};

type GenResult = {
  control_state: "in_control" | "at_risk" | "out_of_control";
  discipline_score: number;
  allowed_tiers: string[];
  applied_restrictions: string[];
  weak_categories: string[];
  focus: string[];
  suggest_no_trade_day: boolean;
  strategy_name: string;
  generated_for: string;
  rules: RuleEntry[];
  escalation: { level: 0 | 1 | 2 | 3; label: string; description: string };
  streak: StreakInfo;
  interpretation: string | null;
  pdf_base64: string;
  filename: string;
};

const CAT_LABEL: Record<RuleEntry["category"], string> = {
  entry: "Entry",
  exit: "Exit",
  risk: "Risk",
  behavior: "Behavior",
  adaptive: "Today",
};

/** Derive Seneca's opening line from trader context (calm, one sentence). */
function openingLine(args: {
  alreadyConfirmed: boolean;
  result: GenResult | null;
  disciplineState?: string;
}): string {
  if (args.alreadyConfirmed) return SenecaVoice.checklist.confirmed;
  if (!args.result) {
    if (args.disciplineState === "locked")
      return "Before anything else — let's reset together.";
    if (args.disciplineState === "at_risk")
      return "Let's slow down and walk through today's rules.";
    return SenecaVoice.checklist.intro;
  }
  if (args.result.suggest_no_trade_day)
    return "Today looks like a no-trade day. Read through, then decide.";
  if (args.result.control_state === "out_of_control")
    return "We're off-balance. Confirm each rule slowly.";
  if (args.result.control_state === "at_risk")
    return "A few cracks showing. Tick what you'll honor today.";
  return "Good rhythm. Confirm your rules and we'll start.";
}

function DailyChecklistPage() {
  const { trader } = useSenecaContext();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [strictAck, setStrictAck] = useState(false);
  const [finalAck, setFinalAck] = useState(false);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState<{
    confirmed_at: string;
  } | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);

  useEffect(() => {
    void fetchDailyStreak().then((s) => {
      if (s) {
        setStreak({
          current: s.current_streak,
          longest: s.longest_streak,
          identity: s.identity_label,
          last_break_date: s.last_break_date,
        });
      }
    });
    void fetchTodayConfirmation().then((c) => {
      if (c) setAlreadyConfirmed({ confirmed_at: c.confirmed_at });
    });
  }, []);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    setAcks({});
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.access_token) {
        toast.error("Sign in required.");
        return;
      }
      const { data, error } = await supabase.functions.invoke(
        "generate-daily-checklist",
        { headers: { Accept: "application/json" } },
      );
      if (error) {
        let body: { code?: string; error?: string; next_action?: string } | null = null;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            body = await ctx.clone().json();
          }
        } catch {
          /* ignore */
        }
        if (body?.code === "STRATEGY_REQUIRED" || body?.code === "STRATEGY_RULES_EMPTY") {
          toast.error(body.error ?? "Build a strategy first.", {
            action: {
              label: "Open Builder",
              onClick: () => {
                window.location.href = "/hub/strategy";
              },
            },
          });
          return;
        }
        throw new Error(body?.error ?? error.message ?? "Could not generate checklist.");
      }
      const r = data as GenResult;
      setResult(r);
      setStreak(r.streak);
      const initial: Record<string, boolean> = {};
      r.rules.forEach((rule) => {
        initial[rule.id] = false;
      });
      setAcks(initial);
      saveDailyChecklist({
        generated_for: r.generated_for,
        control_state: r.control_state,
        discipline_score: r.discipline_score,
        allowed_tiers: r.allowed_tiers,
        applied_restrictions: r.applied_restrictions,
        weak_categories: r.weak_categories ?? [],
        focus: r.focus ?? [],
        suggest_no_trade_day: r.suggest_no_trade_day,
        strategy_name: r.strategy_name,
      });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not generate checklist.");
    } finally {
      setLoading(false);
    }
  };

  const allTicked = useMemo(() => {
    if (!result) return false;
    return result.rules.length > 0 && result.rules.every((r) => acks[r.id] === true);
  }, [result, acks]);

  const requiresStrictAck = result?.control_state === "out_of_control";
  const canConfirm = allTicked && finalAck && (!requiresStrictAck || strictAck);

  const confirm = async () => {
    if (!result || !canConfirm) return;
    setConfirming(true);
    try {
      const ackList: RuleAck[] = result.rules.map((r) => ({
        id: r.id,
        label: r.label,
        category: r.category,
        confirmed: !!acks[r.id],
      }));
      const restrictions = [
        ...result.applied_restrictions,
        ...(requiresStrictAck ? ["strict_mode_acknowledged"] : []),
      ];
      const res = await recordConfirmation({
        control_state: result.control_state,
        discipline_score: result.discipline_score,
        allowed_tiers: result.allowed_tiers,
        applied_restrictions: restrictions,
        focus: result.focus,
        rule_acknowledgements: ackList,
        strategy_name: result.strategy_name,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAlreadyConfirmed({ confirmed_at: res.row.confirmed_at });
      toast.success(SenecaVoice.checklist.confirmed);
    } finally {
      setConfirming(false);
    }
  };

  const download = () => {
    if (!result) return;
    const bin = atob(result.pdf_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedRules = useMemo(() => {
    if (!result) return [];
    const order: RuleEntry["category"][] = ["entry", "exit", "risk", "behavior", "adaptive"];
    return order
      .map((cat) => ({ cat, items: result.rules.filter((r) => r.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [result]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const opening = openingLine({
    alreadyConfirmed: !!alreadyConfirmed,
    result,
    disciplineState: trader?.discipline?.state,
  });

  // Mentor tone: block when off balance, ack when locked, calm otherwise
  const mentorTone: "calm" | "block" | "ack" = alreadyConfirmed
    ? "ack"
    : result?.control_state === "out_of_control" || result?.suggest_no_trade_day
      ? "block"
      : "calm";

  return (
    <SenecaScreen back={{ to: "/hub", label: "Today" }}>
      <SenecaHeader
        title="Daily checklist"
        subtitle={`${today}${streak?.identity ? ` · ${streak.identity}` : ""}`}
      />

      <MentorLine tone={mentorTone}>{opening}</MentorLine>

      {/* GENERATE STATE */}
      {!result && !alreadyConfirmed && (
        <FadeIn className="flex flex-col gap-3">
          <PrimaryAction onClick={generate} loading={loading} disabled={loading}>
            {loading ? "Preparing your rules…" : "Show me today's rules"}
          </PrimaryAction>
        </FadeIn>
      )}

      {/* ALREADY CONFIRMED, NO RESULT FETCHED */}
      {!result && alreadyConfirmed && (
        <FadeIn className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground">
            Locked at {new Date(alreadyConfirmed.confirmed_at).toLocaleTimeString()}.
          </div>
          <SecondaryAction onClick={generate} disabled={loading}>
            {loading ? "Refreshing…" : "Review today's rules again"}
          </SecondaryAction>
        </FadeIn>
      )}

      {/* RESULT */}
      {result && (
        <FadeIn className="flex flex-col gap-6">
          {/* Optional one-line interpretation, quietly */}
          {result.interpretation && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {result.interpretation}
            </p>
          )}

          {/* Focus — at most a few quiet bullets */}
          {result.focus.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Focus
              </div>
              <ul className="flex flex-col gap-1 text-sm text-foreground/90">
                {result.focus.slice(0, 3).map((f, i) => (
                  <li key={i} className="leading-relaxed">
                    — {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rules — calm, one-line tickable items */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Your rules
              </div>
              <div className="text-[11px] text-muted-foreground">
                {Object.values(acks).filter(Boolean).length} / {result.rules.length}
              </div>
            </div>

            {groupedRules.map(({ cat, items }) => (
              <div key={cat} className="flex flex-col gap-2">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                  {CAT_LABEL[cat]}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {items.map((rule) => {
                    const checked = !!acks[rule.id];
                    const disabled = !!alreadyConfirmed;
                    return (
                      <li key={rule.id}>
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${
                            checked
                              ? "border-foreground/30 bg-card/70 text-foreground"
                              : "border-border/50 bg-card/30 text-foreground/80 hover:bg-card/50"
                          } ${disabled ? "cursor-default opacity-80" : ""}`}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-md border ${
                              checked
                                ? "border-foreground bg-foreground text-background"
                                : "border-border/70 bg-transparent"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) =>
                              setAcks((s) => ({ ...s, [rule.id]: e.target.checked }))
                            }
                          />
                          <span className="min-w-0 flex-1 leading-relaxed">
                            {rule.label}
                            {rule.weak && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                                · soft spot
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Commitment + primary action */}
          {alreadyConfirmed ? (
            <FadeIn className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 text-sm text-foreground/80">
                <Lock className="h-4 w-4" />
                <span>
                  Locked at{" "}
                  {new Date(alreadyConfirmed.confirmed_at).toLocaleTimeString()}.
                </span>
              </div>
              <SecondaryAction onClick={download}>
                <Download className="mr-2 h-4 w-4" />
                Save a PDF copy
              </SecondaryAction>
            </FadeIn>
          ) : (
            <div className="flex flex-col gap-3">
              {requiresStrictAck && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-card/40 px-3.5 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={strictAck}
                    onChange={(e) => setStrictAck(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span className="leading-relaxed text-foreground/90">
                    I'm off-balance today. I'll only take A+ setups.
                  </span>
                </label>
              )}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-card/40 px-3.5 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={finalAck}
                  onChange={(e) => setFinalAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span className="leading-relaxed text-foreground/90">
                  I'll follow my system today, not my emotions.
                </span>
              </label>

              <PrimaryAction
                onClick={confirm}
                disabled={!canConfirm}
                loading={confirming}
              >
                {confirming ? "Locking your day…" : "Lock today and start"}
              </PrimaryAction>

              {!canConfirm && (
                <p className="text-xs text-muted-foreground">
                  {!allTicked
                    ? "Tick each rule when you're ready."
                    : requiresStrictAck && !strictAck
                      ? "One more — accept the strict-mode commitment."
                      : "Accept the final commitment to continue."}
                </p>
              )}
            </div>
          )}

          {/* Quiet utilities */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/30 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/30 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {loading ? "Refreshing…" : "Regenerate"}
            </button>
          </div>
        </FadeIn>
      )}
    </SenecaScreen>
  );
}
