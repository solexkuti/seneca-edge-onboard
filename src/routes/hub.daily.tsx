// /hub/daily — Interactive Daily Execution Checklist.
// This is the primary interface. The user MUST tick every rule and confirm
// before any trading session. PDF is supporting material, not the entry point.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Download,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Flame,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import RequireAuth from "@/components/auth/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { saveDailyChecklist } from "@/lib/dailyChecklistCache";
import {
  fetchTodayConfirmation,
  recordConfirmation,
  type RuleAck,
} from "@/lib/checklistConfirmation";
import { fetchDailyStreak } from "@/lib/dailyStreak";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/daily")({
  head: () => ({
    meta: [
      { title: "Daily Checklist — SenecaEdge" },
      {
        name: "description",
        content:
          "Adaptive daily execution checklist. Tick every rule and lock today's plan before trading.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <DailyChecklistPage />
    </RequireAuth>
  ),
});

type RuleEntry = {
  id: string;
  category: "entry" | "exit" | "risk" | "behavior" | "adaptive";
  label: string;
  weak: boolean;
};

type Escalation = {
  level: 0 | 1 | 2 | 3;
  label: string;
  description: string;
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
  escalation: Escalation;
  streak: StreakInfo;
  interpretation: string | null;
  pdf_base64: string;
  filename: string;
};

function StateBadge({ state }: { state: GenResult["control_state"] }) {
  const cfg =
    state === "in_control"
      ? { Icon: ShieldCheck, label: "IN CONTROL", cls: "bg-emerald-600/10 text-emerald-700 ring-emerald-600/20" }
      : state === "at_risk"
        ? { Icon: Shield, label: "AT RISK", cls: "bg-amber-600/10 text-amber-700 ring-amber-600/20" }
        : { Icon: ShieldAlert, label: "OUT OF CONTROL", cls: "bg-red-600/10 text-red-700 ring-red-600/20" };
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${cfg.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {cfg.label}
    </span>
  );
}

function EscalationPill({ esc }: { esc: Escalation }) {
  const cls =
    esc.level === 0
      ? "bg-slate-500/10 text-slate-700 ring-slate-500/20"
      : esc.level === 1
        ? "bg-amber-500/10 text-amber-700 ring-amber-500/20"
        : esc.level === 2
          ? "bg-orange-600/10 text-orange-700 ring-orange-600/20"
          : "bg-red-600/10 text-red-700 ring-red-600/20";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${cls}`}>
      {esc.label}
    </span>
  );
}

function CategoryLabel({ c }: { c: RuleEntry["category"] }) {
  const map = {
    entry: "Entry",
    exit: "Exit",
    risk: "Risk",
    behavior: "Behavior",
    adaptive: "Today's Adjustment",
  };
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {map[c]}
    </span>
  );
}

function DailyChecklistPage() {
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

  // On mount: load streak + check whether today is already confirmed.
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
        // Try to extract structured error code from the response body.
        let code: string | undefined;
        let message: string | undefined;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            code = body?.code;
            message = body?.error;
          }
        } catch {
          /* fall through to generic */
        }
        if (code === "STRATEGY_REQUIRED" || code === "STRATEGY_RULES_EMPTY") {
          toast.error(message ?? "Build a strategy first.", {
            action: {
              label: "Open Builder",
              onClick: () => {
                window.location.href = "/hub/strategy";
              },
            },
          });
          return;
        }
        throw new Error(message ?? error.message);
      }
      const r = data as GenResult;
      setResult(r);
      setStreak(r.streak);
      // Pre-mark adaptive rules as unticked (must be confirmed manually)
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
  const canConfirm =
    allTicked && finalAck && (!requiresStrictAck || strictAck);

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
      // Tag the strict-mode commitment so the trade-lock layer knows the user
      // explicitly accepted the extra constraint.
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
      toast.success("Locked in. Trading is unlocked for today.");
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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const groupedRules = useMemo(() => {
    if (!result) return [];
    const order: RuleEntry["category"][] = ["entry", "exit", "risk", "behavior", "adaptive"];
    return order
      .map((cat) => ({ cat, items: result.rules.filter((r) => r.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [result]);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10 mx-auto w-full max-w-[680px] px-5 pt-6 pb-24">
        <div className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-card px-3 text-sm ring-1 ring-border shadow-soft hover:shadow-card-premium"
          >
            ← Hub
          </Link>
          {streak && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-border shadow-soft">
              <Flame className={`h-4 w-4 ${streak.current > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Identity</div>
                <div className="text-xs font-semibold text-foreground">{streak.identity}</div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Daily Execution
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Today's Checklist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tick every rule. Lock the plan. The mentor and trade check will hold
            you to it.
          </p>
        </div>

        {/* GENERATE STATE */}
        {!result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft"
          >
            <p className="text-sm text-foreground">
              Generate today's adaptive checklist.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Built from your strategy, last 20 trades, and behavior patterns.
              AI provides interpretation only — never rules.
            </p>
            {alreadyConfirmed && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Today already confirmed at{" "}
                {new Date(alreadyConfirmed.confirmed_at).toLocaleTimeString()}.
              </div>
            )}
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <>{alreadyConfirmed ? "Refresh today's checklist" : "Generate today's checklist"}</>
              )}
            </button>
          </motion.div>
        )}

        {/* RESULT — INTERACTIVE */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            {/* Status row */}
            <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <StateBadge state={result.control_state} />
                <EscalationPill esc={result.escalation} />
                {result.suggest_no_trade_day && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-700 ring-1 ring-red-600/20">
                    <AlertTriangle className="h-3.5 w-3.5" /> No-Trade Day
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Discipline</div>
                  <div className="mt-1 font-semibold text-foreground">{result.discipline_score} / 100</div>
                </div>
                <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Allowed</div>
                  <div className="mt-1 font-semibold text-foreground">{result.allowed_tiers.join(" · ")}</div>
                </div>
                <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Streak</div>
                  <div className="mt-1 font-semibold text-foreground">
                    {result.streak.current} <span className="text-xs font-normal text-muted-foreground">/ best {result.streak.longest}</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{result.escalation.description}</p>
            </div>

            {/* AI behavioral interpretation */}
            {result.interpretation && (
              <div className="rounded-2xl border-l-4 border-amber-500/60 bg-card p-5 ring-1 ring-border shadow-soft">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  What's actually going on
                </div>
                <p className="mt-1.5 text-sm text-foreground leading-relaxed">
                  {result.interpretation}
                </p>
              </div>
            )}

            {/* Focus */}
            {result.focus.length > 0 && (
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Focus for today
                </div>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                  {result.focus.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interactive checklist */}
            <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pre-trade checklist
                  </div>
                  <h2 className="mt-0.5 text-base font-semibold text-foreground">
                    Confirm every rule
                  </h2>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Object.values(acks).filter(Boolean).length} / {result.rules.length}
                </div>
              </div>

              <div className="mt-4 space-y-5">
                {groupedRules.map(({ cat, items }) => (
                  <div key={cat}>
                    <CategoryLabel c={cat} />
                    <ul className="mt-1.5 space-y-1.5">
                      {items.map((rule) => {
                        const checked = !!acks[rule.id];
                        return (
                          <li key={rule.id}>
                            <label
                              className={`flex cursor-pointer items-start gap-3 rounded-lg p-2.5 ring-1 transition ${
                                checked
                                  ? "bg-emerald-600/5 ring-emerald-600/20"
                                  : rule.weak
                                    ? "bg-amber-500/5 ring-amber-500/20"
                                    : "bg-background ring-border hover:ring-primary/30"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setAcks((s) => ({ ...s, [rule.id]: e.target.checked }))
                                }
                                disabled={!!alreadyConfirmed}
                                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-foreground">{rule.label}</div>
                                {rule.weak && (
                                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                    Weak area — pay extra attention
                                  </div>
                                )}
                                {rule.category === "adaptive" && (
                                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                    Today only
                                  </div>
                                )}
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Final commitment + confirm */}
            <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
              {alreadyConfirmed ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Lock className="h-4 w-4" />
                  <span>
                    Plan locked at{" "}
                    {new Date(alreadyConfirmed.confirmed_at).toLocaleTimeString()}.
                    Trading is unlocked. Mentor is enforcing.
                  </span>
                </div>
              ) : (
                <>
                  {/* Strict-mode extra commitment */}
                  {requiresStrictAck && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-red-600/5 p-3 ring-1 ring-red-600/20">
                      <input
                        type="checkbox"
                        checked={strictAck}
                        onChange={(e) => setStrictAck(e.target.checked)}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-red-700">
                          Strict mode commitment
                        </div>
                        <div className="mt-0.5 text-sm text-foreground">
                          I understand I am currently not in control. I will only
                          take A+ setups today.
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Final commitment quote */}
                  <label
                    className={`mt-3 flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${
                      finalAck
                        ? "bg-emerald-600/5 ring-emerald-600/20"
                        : "bg-background ring-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={finalAck}
                      onChange={(e) => setFinalAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug text-foreground">
                        I confirm I will follow my system. Not my emotions.
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={confirm}
                    disabled={!canConfirm || confirming}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-50"
                  >
                    {confirming ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Unlocking…</>
                    ) : (
                      <><Lock className="h-4 w-4" /> Confirm & Unlock Trading</>
                    )}
                  </button>
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border hover:bg-background"
                >
                  <Download className="h-3.5 w-3.5" /> PDF copy
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border hover:bg-background disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…</>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
                  )}
                </button>
              </div>
              {!alreadyConfirmed && !canConfirm && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {!allTicked
                    ? "Tick every rule, then accept the commitment to unlock trading."
                    : requiresStrictAck && !strictAck
                      ? "Accept the strict-mode commitment to continue."
                      : "Accept the final commitment to unlock trading."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
