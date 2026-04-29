import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import FeatureShell from "./FeatureShell";
import { useDbJournal } from "@/hooks/useDbJournal";
import { summarizeJournal } from "@/lib/journalSummary";
import { computeIntelligence } from "@/lib/intelligence";
import {
  fetchRecentPatterns,
  type DbBehaviorPattern,
} from "@/lib/dbBehaviorPatterns";
import {
  pickIntroSuggestions,
  INTENT_STYLES,
} from "@/lib/mentorSuggestions";
import { readProfile, summarizeProfile } from "@/lib/onboardingProfile";
import {
  loadActiveStrategyContext,
  summarizeRulesForAI,
  type ActiveStrategyContext,
} from "@/lib/activeStrategy";
import { getDailyChecklist } from "@/lib/dailyChecklistCache";
import { toast } from "sonner";
// MentorRecoveryChecklist removed — Seneca no longer enforces recovery.
import { useTraderState } from "@/hooks/useTraderState";
import { useBehavioralJournal } from "@/hooks/useBehavioralJournal";
import { mistakeFrequency, MISTAKE_LABEL } from "@/lib/behavioralJournal";
import { usePerformance } from "@/hooks/usePerformance";
import { buildQuickPrompts } from "@/lib/mentorQuickPrompts";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const MENTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`;
const SESSION_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function AiMentorChat() {
  const { state: traderState } = useTraderState();
  const { rows, entries: journal } = useDbJournal();
  const { entries: behavioralEntries, score: behavioralScore } = useBehavioralJournal(20);
  const { mentorPayload: performancePayload } = usePerformance(20);
  const intelligence = useMemo(() => computeIntelligence(rows), [rows]);

  // Dynamic, state-driven quick prompts. Rotation key updates whenever the
  // user logs new activity or discipline shifts — so chips feel reactive.
  const quickPrompts = useMemo(() => {
    const tradeCount = Math.max(
      performancePayload?.windowSize ?? 0,
      behavioralEntries.length,
      rows.length,
    );
    const rotation =
      behavioralEntries.length +
      Math.floor((traderState.discipline.score ?? 0) / 10);
    return buildQuickPrompts(
      {
        tradeCount,
        disciplineScore: traderState.loading
          ? null
          : traderState.discipline.score,
        winRate: performancePayload?.winRate ?? null,
        avgRR: performancePayload?.avgRR ?? null,
      },
      rotation,
    );
  }, [
    performancePayload?.windowSize,
    performancePayload?.winRate,
    performancePayload?.avgRR,
    behavioralEntries.length,
    rows.length,
    traderState.loading,
    traderState.discipline.score,
  ]);

  const [recentPatterns, setRecentPatterns] = useState<DbBehaviorPattern[]>([]);
  const [activeStrategy, setActiveStrategy] =
    useState<ActiveStrategyContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRecentPatterns(3).then((p) => {
      if (!cancelled) setRecentPatterns(p);
    });
    loadActiveStrategyContext().then((s) => {
      if (!cancelled) setActiveStrategy(s);
    });
    return () => {
      cancelled = true;
    };
  }, [rows.length]);

  // Calm, present intro grounded in the user's real behavioral data.
  // No enforcement, no warnings — just observation when something stands out.
  const introContent = useMemo(() => {
    const last = behavioralEntries[0];
    const breakStreak = last?.break_streak_after ?? 0;
    const cleanStreak = last?.clean_streak_after ?? 0;
    const topMistake = mistakeFrequency(behavioralEntries)[0];
    if (behavioralEntries.length === 0) {
      return "I'm here when you start.\n\nLog your first trade, and I'll help you understand how you actually trade — not how you think you trade.";
    }
    if (breakStreak >= 3 && topMistake) {
      return `I'm noticing a pattern in your last ${breakStreak} trades — ${topMistake.label.toLowerCase()} keeps showing up.\n\nWant to look at it together?`;
    }
    if (breakStreak >= 2) {
      return `Two recent trades broke the same kind of rule.\n\nNot a problem yet — but worth a closer look. Want me to break it down?`;
    }
    if (cleanStreak >= 3) {
      return `${cleanStreak} clean trades in a row.\n\nThis is what your edge looks like when you let it work. Anything you want to lock in?`;
    }
    if (topMistake && topMistake.count >= 3) {
      return `One thing keeps repeating across your last trades: ${topMistake.label.toLowerCase()} (${topMistake.count}x).\n\nWant to dig into it?`;
    }
    return `Behavior is steady. Ask me anything about your last trades, or tap "Review my trades".`;
  }, [behavioralEntries]);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "intro",
      role: "assistant",
      content: introContent,
    },
  ]);

  // Keep intro fresh until the user sends their first message.
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === "intro"
        ? [{ id: "intro", role: "assistant", content: introContent }]
        : prev,
    );
  }, [introContent]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  // Suggestions disappear permanently once the user types or picks one.
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build intro suggestions once, lightly tailored to discipline state.
  const suggestions = useMemo(
    () =>
      pickIntroSuggestions({
        journal,
        disciplineState: traderState.discipline.state,
        disciplineScore: traderState.discipline.score,
      }),
    [journal, traderState.discipline.state, traderState.discipline.score],
  );

  const showSuggestions =
    !suggestionsDismissed &&
    !streaming &&
    messages.length === 1 &&
    draft.trim().length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  // Hard-gated, deterministic mentor reply (no AI call).
  // Tiny delay just to feel natural — short enough to stay snappy.
  const respondLocally = (history: Msg[], content: string) => {
    const id = `a-${Date.now()}`;
    window.setTimeout(() => {
      setMessages([...history, { id, role: "assistant", content }]);
      setStreaming(false);
    }, 120);
  };

  // Lightweight intent classifier — keyword based, deterministic.
  type Intent =
    | "TRADE_REVIEW"
    | "PATTERN_ANALYSIS"
    | "METRICS_EXPLANATION"
    | "GENERAL_TRADING_QUESTION"
    | "GUIDANCE";

  const classifyIntent = (text: string): Intent => {
    const t = text.toLowerCase();

    // TRADE_REVIEW — asking about own trades / mistakes
    if (
      /\b(review|recap|breakdown|analy[sz]e)\b.*\b(trade|setup|entry|exit)\b/.test(t) ||
      /\b(my|last|recent)\s+(trade|trades|setup|entry|exit)\b/.test(t) ||
      /\bwhat\s+did\s+i\s+do\s+(wrong|right)\b/.test(t)
    ) {
      return "TRADE_REVIEW";
    }

    // PATTERN_ANALYSIS — recurring behavior
    if (
      /\b(pattern|patterns|repeat|repeating|keeps?\s+happening|tendency|tendencies|habit|habits)\b/.test(t) ||
      /\bspot\b.*\bpattern\b/.test(t)
    ) {
      return "PATTERN_ANALYSIS";
    }

    // METRICS_EXPLANATION — own stats / how scores work
    if (
      /\b(my\s+)?(stats|metrics|score|discipline|win\s*rate|winrate|rr|r:r|r\/r|expectancy|drawdown)\b/.test(t) ||
      /\bhow\s+is\s+.*\s+(calculated|computed|measured)\b/.test(t) ||
      /\bexplain\s+(my\s+)?(stats|metrics|score|numbers)\b/.test(t)
    ) {
      return "METRICS_EXPLANATION";
    }

    // GUIDANCE — improvement / something feels off
    if (
      /\b(how\s+(can|do)\s+i\s+improve|get\s+better|fix|feel(s)?\s+off|struggling|stuck)\b/.test(t) ||
      /\b(my\s+)?(exits?|entries|risk|sizing)\s+(feel|feels|are)\b/.test(t)
    ) {
      return "GUIDANCE";
    }

    // Default — generic trading concept question (educational)
    return "GENERAL_TRADING_QUESTION";
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const history = [...messages, userMsg];
    // Echo the user message immediately and flip streaming on the same tick
    // so the input clears and the typing indicator shows without waiting for
    // context-building or the network round-trip.
    setMessages(history);
    setDraft("");
    setStreaming(true);

    // ---- HARD GATE (runs before any AI call) ----
    const tradeCount = Math.max(
      performancePayload?.windowSize ?? 0,
      behavioralEntries.length,
      rows.length,
    );
    const lastTradeExists = tradeCount > 0;
    const asksAboutLastTrade = /\blast\s+trade\b/i.test(trimmed);
    const intent = classifyIntent(trimmed);

    // CASE A: zero trades — branch by intent. Only block data-dependent intents.
    if (tradeCount === 0) {
      if (intent === "TRADE_REVIEW") {
        respondLocally(
          history,
          "You haven't logged a trade yet, so there's nothing to review.\n\nLog one trade and I'll break it down with you.",
        );
        return;
      }
      if (intent === "PATTERN_ANALYSIS") {
        respondLocally(
          history,
          "No patterns yet — that only shows up after a few trades.\n\nGive me a handful and I'll start connecting things.",
        );
        return;
      }
      if (intent === "METRICS_EXPLANATION") {
        respondLocally(
          history,
          "Your metrics aren't active yet because nothing has been logged.\n\nOnce you start trading, I'll calculate things like win rate, RR, and discipline automatically.",
        );
        return;
      }
      if (intent === "GUIDANCE") {
        respondLocally(
          history,
          "Right now the focus is simple — log clean trades.\n\nThat's what gives me something real to work with.",
        );
        return;
      }
      // GENERAL_TRADING_QUESTION → fall through to AI (education is allowed).
    }

    // CASE B: user asks about "last trade" but none exists.
    if (!lastTradeExists && asksAboutLastTrade) {
      respondLocally(
        history,
        "You haven't logged a trade yet, so there's nothing for me to review.\n\nLog one trade and I'll break it down with you.",
      );
      return;
    }
    // ---- END HARD GATE ----

    // Build user context from real signals: trading journal + onboarding profile + intelligence + patterns.
    const journalSummary = summarizeJournal(journal) ?? undefined;
    const profileSummary = summarizeProfile(readProfile()) ?? undefined;
    const intelligencePayload = intelligence.windowSize > 0
      ? {
          disciplineScore: intelligence.disciplineScore,
          disciplineClass: intelligence.disciplineClass,
          windowSize: intelligence.windowSize,
          mostCommonMistake: intelligence.mostCommonMistake?.label ?? null,
          mostCommonMistakeTag: intelligence.mostCommonMistakeTag?.label ?? null,
          disciplineStreak: intelligence.disciplineStreak,
          twoUndisciplinedInARow: intelligence.twoUndisciplinedInARow,
          strictModeActive: intelligence.strictModeActive,
        }
      : undefined;
    const recentPatternsPayload = recentPatterns.length > 0
      ? recentPatterns.map((p) => ({
          kind: p.kind,
          message: p.message,
          detected_at: p.detected_at,
        }))
      : undefined;
    // Last two journal rows used by strict mode to name the pattern.
    const lastTwoTrades = rows.slice(0, 2).map((r) => {
      const broken: string[] = [];
      if (!r.followed_entry) broken.push("entry");
      if (!r.followed_exit) broken.push("exit");
      if (!r.followed_risk) broken.push("risk");
      if (!r.followed_behavior) broken.push("behavior");
      return {
        when: new Date(r.timestamp).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        market: r.pair,
        direction: r.direction,
        result: r.result,
        followedPlan: r.followedPlan,
        brokenRules: broken,
        mistakeTag: r.mistake_tag,
      };
    });
    const lastTwoPayload = lastTwoTrades.length > 0 ? lastTwoTrades : undefined;
    const strategyPayload = activeStrategy?.blueprint
      ? {
          name: activeStrategy.blueprint.name,
          locked: activeStrategy.blueprint.locked,
          rules: summarizeRulesForAI(activeStrategy.rules),
        }
      : undefined;
    const dailyChecklistPayload = getDailyChecklist() ?? undefined;

    // TRADER_STATE awareness payload — Mentor MUST receive the full system
    // state on every response so it can explain restrictions, score moves,
    // and next actions deterministically. Read-only — Mentor never mutates.
    const lastDecision = traderState.discipline.recent[0] ?? null;
    const lastAnalyzer = traderState.discipline.recent.find(
      (d) => d.source === "analyzer",
    );
    const summarizeViolations = (v: unknown): string | null => {
      if (Array.isArray(v) && v.length) {
        return v.filter((x) => typeof x === "string").join(", ") || null;
      }
      if (v && typeof v === "object") {
        const vals = Object.values(v as Record<string, unknown>).filter(
          (x) => typeof x === "string",
        );
        return vals.length ? vals.join(", ") : null;
      }
      return null;
    };
    const traderStatePayload = traderState.loading
      ? undefined
      : {
          strategy: {
            exists: !!traderState.strategy?.blueprint,
            locked: !!traderState.strategy?.blueprint?.locked,
            name: traderState.strategy?.blueprint?.name ?? null,
          },
          discipline: {
            score: traderState.discipline.score,
            state: traderState.discipline.state,
            consecutive_breaks: traderState.discipline.consecutive_breaks,
            last_score_delta: lastDecision?.score_delta ?? null,
            last_reason: lastDecision
              ? summarizeViolations(lastDecision.violations) ??
                `${lastDecision.source} ${lastDecision.verdict}`
              : null,
            last_source: lastDecision?.source ?? null,
          },
          session: {
            checklist_confirmed: traderState.session.checklist_confirmed,
            trading_allowed: traderState.session.trading_allowed,
          },
          last_analyzer_event: lastAnalyzer
            ? {
                verdict: lastAnalyzer.verdict,
                score_delta: lastAnalyzer.score_delta,
                reason:
                  summarizeViolations(lastAnalyzer.violations) ??
                  lastAnalyzer.verdict,
                created_at: lastAnalyzer.created_at,
              }
            : null,
          blocks: {
            no_strategy: traderState.blocks.no_strategy,
            not_confirmed: traderState.blocks.not_confirmed,
            discipline_locked: traderState.blocks.discipline_locked,
            in_recovery: traderState.blocks.in_recovery,
          },
          recovery: {
            active: !!traderState.recovery.active_session,
            step: traderState.recovery.active_session?.step ?? null,
            probation_active: traderState.recovery.probation.active,
          },
        };

    // Behavioral journal payload — new fixed-delta system.
    const behavioralPayload = behavioralEntries.length > 0
      ? {
          disciplineScore: behavioralScore,
          recentTrades: behavioralEntries.slice(0, 20).map((e) => ({
            when: new Date(e.created_at).toLocaleString(undefined, {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            }),
            asset: e.asset,
            resultR: e.result_r,
            classification: e.classification,
            scoreDelta: e.score_delta,
            mistakes: e.mistakes.map((m) => MISTAKE_LABEL[m]),
          })),
          mistakeFrequency: mistakeFrequency(behavioralEntries).slice(0, 5),
          cleanStreak: behavioralEntries[0]?.clean_streak_after ?? 0,
          breakStreak: behavioralEntries[0]?.break_streak_after ?? 0,
        }
      : undefined;

    const ctx =
      journalSummary || profileSummary || intelligencePayload || recentPatternsPayload || lastTwoPayload || strategyPayload || dailyChecklistPayload || traderStatePayload || behavioralPayload || performancePayload
        ? {
            ...(journalSummary ? { journalSummary } : {}),
            ...(profileSummary ? { profileSummary } : {}),
            ...(intelligencePayload ? { intelligence: intelligencePayload } : {}),
            ...(recentPatternsPayload ? { recentPatterns: recentPatternsPayload } : {}),
            ...(lastTwoPayload ? { lastTwoTrades: lastTwoPayload } : {}),
            ...(strategyPayload ? { activeStrategy: strategyPayload } : {}),
            ...(dailyChecklistPayload ? { dailyChecklist: dailyChecklistPayload } : {}),
            ...(traderStatePayload ? { traderState: traderStatePayload } : {}),
            ...(behavioralPayload ? { behavioralJournal: behavioralPayload } : {}),
            ...(performancePayload ? { performance: performancePayload } : {}),
          }
        : undefined;

    // Strip the intro message from what we send to the model — it's UI only.
    const wireMessages = history
      .filter((m) => m.id !== "intro")
      .map((m) => ({ role: m.role, content: m.content }));

    let assistantId = `a-${Date.now()}`;
    let acc = "";
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const resp = await fetch(MENTOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: wireMessages, context: ctx, sessionId: SESSION_ID }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          toast.error("Too many requests. Wait a moment and try again.");
        } else if (resp.status === 402) {
          toast.error("AI credits exhausted. Add funds in workspace settings.");
        } else {
          toast.error("Mentor is unavailable right now.");
        }
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as
              | string
              | undefined;
            if (delta) {
              acc += delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: acc } : m,
                ),
              );
            }
          } catch {
            // partial JSON across chunks — re-buffer
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection lost. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  };

  return (
    <FeatureShell
      eyebrow="AI Mentor"
      title="Seneca."
      subtitle="Pattern-aware trading partner."
    >
      <div className="flex h-[calc(100svh-220px)] min-h-[480px] flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-soft">
        {/* Mentor identity */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-mix shadow-glow-gold">
            <Sparkles className="h-4 w-4 text-[#0B0B0D]" strokeWidth={2.4} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-card" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-text-primary">Seneca</p>
            <p className="text-[11px] text-text-secondary">
              I track how you trade — so you can see what actually drives your results.
            </p>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isLatestAssistant =
                !isUser &&
                !streaming &&
                m.content.length > 0 &&
                i === messages.length - 1;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      isUser
                        ? "bubble-user max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-snug font-medium"
                        : `bubble-assistant max-w-[82%] whitespace-pre-wrap px-3.5 py-2.5 text-[13.5px] leading-snug ${
                            isLatestAssistant ? "bubble-pulse" : ""
                          }`
                    }
                  >
                    {m.content || (m.role === "assistant" && streaming ? "…" : "")}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Quick action prompts — always available above composer */}
        {!streaming ? (
          <div className="border-t border-border/60 px-4 py-2.5">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {quickPrompts.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setSuggestionsDismissed(true);
                    send(q.prompt);
                  }}
                  disabled={streaming}
                  className="shrink-0 rounded-full bg-card px-3 py-1.5 text-[11.5px] font-medium text-text-primary/85 ring-1 ring-border/70 transition-all hover:bg-text-primary/[0.04] hover:ring-primary/25 active:scale-[0.97] disabled:opacity-40"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSuggestionsDismissed(true);
            send(draft);
          }}
          className="flex items-center gap-2 border-t border-border/60 bg-card px-3 py-3"
        >
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value.length > 0) setSuggestionsDismissed(true);
            }}
            placeholder="Ask Seneca…"
            disabled={streaming}
            className="h-10 flex-1 rounded-xl bg-text-primary/[0.04] px-3.5 text-[14px] text-text-primary placeholder:text-text-secondary/70 ring-1 ring-border focus:outline-none focus:ring-brand/40 disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!draft.trim() || streaming}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-[#0B0B0D] shadow-glow-gold transition-all disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </FeatureShell>
  );
}
