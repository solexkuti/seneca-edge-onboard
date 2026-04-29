import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles, AlertTriangle } from "lucide-react";
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
import MentorRecoveryChecklist from "./MentorRecoveryChecklist";
import { useTraderState } from "@/hooks/useTraderState";

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
  const intelligence = useMemo(() => computeIntelligence(rows), [rows]);
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

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "Hi. I'm Seneca — your trading mentor.\n\nI track how you think, not just what you do.\n\nIf something is off, I'll point it out. If you're aligned, I'll keep you there.\n\nAsk what matters.",
    },
  ]);
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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setDraft("");
    setStreaming(true);

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

    const ctx =
      journalSummary || profileSummary || intelligencePayload || recentPatternsPayload || lastTwoPayload || strategyPayload || dailyChecklistPayload || traderStatePayload
        ? {
            ...(journalSummary ? { journalSummary } : {}),
            ...(profileSummary ? { profileSummary } : {}),
            ...(intelligencePayload ? { intelligence: intelligencePayload } : {}),
            ...(recentPatternsPayload ? { recentPatterns: recentPatternsPayload } : {}),
            ...(lastTwoPayload ? { lastTwoTrades: lastTwoPayload } : {}),
            ...(strategyPayload ? { activeStrategy: strategyPayload } : {}),
            ...(dailyChecklistPayload ? { dailyChecklist: dailyChecklistPayload } : {}),
            ...(traderStatePayload ? { traderState: traderStatePayload } : {}),
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
      subtitle="A calm, supportive trading partner. Here to think things through with you."
    >
      <div className="flex h-[calc(100svh-220px)] min-h-[480px] flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-soft">
        {/* Mentor identity */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-mix shadow-glow-primary">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.2} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-text-primary">Seneca</p>
            <p className="text-[11px] text-text-secondary">
              {journal.length > 0
                ? `Aware of your last ${Math.min(journal.length, 10)} trades`
                : "No journal data — answers will be general"}
            </p>
          </div>
          {intelligence.strictModeActive ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              title="Two undisciplined trades in a row — Seneca is firmer until you log two clean trades."
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 ring-1 ring-rose-500/25"
            >
              <AlertTriangle className="h-3 w-3 text-rose-700" strokeWidth={2.6} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-rose-800">
                Strict mode
              </span>
            </motion.div>
          ) : null}
        </div>

        {intelligence.strictModeActive ? (
          <div className="border-b border-rose-500/15 bg-rose-500/[0.04] px-4 py-2">
            <p className="text-[11.5px] leading-snug text-rose-900/85">
              Two undisciplined trades in a row. Seneca's tone is firmer this turn — log two clean trades to lift it.
            </p>
          </div>
        ) : null}

        {/* Mini interactive recovery checklist — only shown while the
           Analyzer is gated (locked discipline OR checklist not confirmed).
           Each completed step inserts a synthetic positive analyzer_event
           and broadcasts, which progressively lifts the lock in real time. */}
        {(traderState.discipline.state === "locked" ||
          traderState.discipline.state === "at_risk" ||
          !traderState.session.checklist_confirmed) && (
          <MentorRecoveryChecklist />
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[82%] rounded-2xl rounded-br-md bg-gradient-primary px-3.5 py-2.5 text-[13.5px] leading-snug text-white shadow-glow-primary"
                      : "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-text-primary/[0.04] px-3.5 py-2.5 text-[13.5px] leading-snug text-text-primary ring-1 ring-border"
                  }
                >
                  {m.content || (m.role === "assistant" && streaming ? "…" : "")}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Dynamic state-aware suggestion pills — refreshed after every message */}
        {!streaming && suggestions.length > 0 ? (
          <div className="border-t border-border/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
              {messages.length === 1 ? "Try asking" : "What's next"}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {suggestions.map((q, i) => {
                  const Icon = q.icon;
                  return (
                    <motion.button
                      key={`${detectedState}-${q.id}`}
                      type="button"
                      onClick={() => send(q.prompt)}
                      disabled={streaming}
                      title={q.prompt}
                      layout
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{
                        duration: 0.22,
                        delay: 0.04 * i,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.96 }}
                      className="group inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[12px] font-medium text-text-primary ring-1 ring-border shadow-soft transition-colors hover:bg-text-primary/[0.04] hover:ring-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon
                        className={`h-3.5 w-3.5 ${INTENT_STYLES[q.intent]} transition-transform group-hover:scale-110`}
                        strokeWidth={2.2}
                      />
                      <span>{q.label}</span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : null}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2 border-t border-border/60 bg-card px-3 py-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask Seneca…"
            disabled={streaming}
            className="h-10 flex-1 rounded-xl bg-text-primary/[0.04] px-3.5 text-[14px] text-text-primary placeholder:text-text-secondary/70 ring-1 ring-border focus:outline-none focus:ring-brand/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!draft.trim() || streaming}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-white shadow-glow-primary transition-all disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </FeatureShell>
  );
}
