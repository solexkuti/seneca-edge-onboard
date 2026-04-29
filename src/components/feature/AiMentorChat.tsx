import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";

import { useDbJournal } from "@/hooks/useDbJournal";
import { summarizeJournal } from "@/lib/journalSummary";
import { computeIntelligence } from "@/lib/intelligence";
import {
  fetchRecentPatterns,
  type DbBehaviorPattern,
} from "@/lib/dbBehaviorPatterns";
import {
  detectMentorState,
  pickMentorSuggestions,
  INTENT_STYLES,
} from "@/lib/mentorSuggestions";
import { readProfile, summarizeProfile } from "@/lib/onboardingProfile";
import { summarizeRulesForAI } from "@/lib/activeStrategy";
import { getDailyChecklist } from "@/lib/dailyChecklistCache";
import MentorRecoveryChecklist from "./MentorRecoveryChecklist";
import { useSenecaContext } from "@/hooks/useSenecaContext";
import {
  SenecaScreen,
  SenecaHeader,
  MentorLine,
  FadeIn,
} from "@/components/seneca";
import { SenecaVoice } from "@/lib/senecaVoice";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const MENTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`;
const SESSION_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function AiMentorChat() {
  const { trader: traderState, blockLine } = useSenecaContext();
  const { rows, entries: journal } = useDbJournal();
  const intelligence = useMemo(() => computeIntelligence(rows), [rows]);
  const [recentPatterns, setRecentPatterns] = useState<DbBehaviorPattern[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchRecentPatterns(3).then((p) => {
      if (!cancelled) setRecentPatterns(p);
    });
    return () => {
      cancelled = true;
    };
  }, [rows.length]);

  const [messages, setMessages] = useState<Msg[]>([
    { id: "intro", role: "assistant", content: SenecaVoice.mentor.greeting },
  ]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [recentSuggestionIds, setRecentSuggestionIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return "";
  }, [messages]);

  const detectedState = useMemo(
    () => detectMentorState(lastUserMessage),
    [lastUserMessage],
  );

  const suggestions = useMemo(
    () =>
      pickMentorSuggestions({
        state: detectedState,
        journal,
        recentlyShownIds: recentSuggestionIds,
      }),
    [detectedState, journal, recentSuggestionIds],
  );

  useEffect(() => {
    if (!suggestions.length) return;
    setRecentSuggestionIds((prev) => {
      const ids = suggestions.map((s) => s.id);
      const merged = [...ids, ...prev.filter((id) => !ids.includes(id))];
      return merged.slice(0, 8);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserMessage, detectedState]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setDraft("");
    setStreaming(true);

    // ----- Context payload (UNCHANGED — full Seneca awareness) -----
    const journalSummary = summarizeJournal(journal) ?? undefined;
    const profileSummary = summarizeProfile(readProfile()) ?? undefined;
    const intelligencePayload =
      intelligence.windowSize > 0
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
    const recentPatternsPayload =
      recentPatterns.length > 0
        ? recentPatterns.map((p) => ({
            kind: p.kind,
            message: p.message,
            detected_at: p.detected_at,
          }))
        : undefined;
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
    const strategyPayload = traderState.strategy?.blueprint
      ? {
          name: traderState.strategy.blueprint.name,
          locked: traderState.strategy.blueprint.locked,
          rules: summarizeRulesForAI(traderState.strategy.rules),
        }
      : undefined;
    const dailyChecklistPayload = getDailyChecklist() ?? undefined;

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
      journalSummary ||
      profileSummary ||
      intelligencePayload ||
      recentPatternsPayload ||
      lastTwoPayload ||
      strategyPayload ||
      dailyChecklistPayload ||
      traderStatePayload
        ? {
            ...(journalSummary ? { journalSummary } : {}),
            ...(profileSummary ? { profileSummary } : {}),
            ...(intelligencePayload ? { intelligence: intelligencePayload } : {}),
            ...(recentPatternsPayload
              ? { recentPatterns: recentPatternsPayload }
              : {}),
            ...(lastTwoPayload ? { lastTwoTrades: lastTwoPayload } : {}),
            ...(strategyPayload ? { activeStrategy: strategyPayload } : {}),
            ...(dailyChecklistPayload
              ? { dailyChecklist: dailyChecklistPayload }
              : {}),
            ...(traderStatePayload ? { traderState: traderStatePayload } : {}),
          }
        : undefined;

    const wireMessages = history
      .filter((m) => m.id !== "intro")
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantId = `a-${Date.now()}`;
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
        body: JSON.stringify({
          messages: wireMessages,
          context: ctx,
          sessionId: SESSION_ID,
        }),
      });

      if (!resp.ok || !resp.body) {
        // Quiet, mentor-tone failure.
        toast(SenecaVoice.fallback.quietError);
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
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast(SenecaVoice.fallback.quietError);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  };

  // Subtitle reflects how much context Seneca has — calm, factual.
  const awarenessLine =
    journal.length > 0
      ? `Reading your last ${Math.min(journal.length, 10)} trades.`
      : SenecaVoice.mentor.empty;

  const showRecovery =
    traderState.discipline.state === "locked" ||
    traderState.discipline.state === "at_risk" ||
    !traderState.session.checklist_confirmed;

  return (
    <SenecaScreen back={{ to: "/hub", label: "Hub" }}>
      <SenecaHeader title="Seneca" subtitle={awarenessLine} />

      {/* One mentor line for the current state, if anything blocks. */}
      {blockLine && <MentorLine tone="block">{blockLine}</MentorLine>}

      {showRecovery && (
        <FadeIn>
          <MentorRecoveryChecklist />
        </FadeIn>
      )}

      {/* Conversation surface — calm card, no glow. */}
      <FadeIn>
        <div className="flex h-[60svh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[82%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-[13.5px] leading-snug text-background"
                        : "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border/50 bg-background/60 px-3.5 py-2.5 text-[13.5px] leading-snug text-foreground"
                    }
                  >
                    {m.content ||
                      (m.role === "assistant" && streaming
                        ? SenecaVoice.thinking
                        : "")}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Suggestion pills */}
          {!streaming && suggestions.length > 0 && (
            <div className="border-t border-border/50 px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
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
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{
                          duration: 0.2,
                          delay: 0.03 * i,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition hover:bg-background hover:text-foreground disabled:opacity-40"
                      >
                        <Icon
                          className={`h-3.5 w-3.5 ${INTENT_STYLES[q.intent]}`}
                          strokeWidth={2.2}
                        />
                        <span>{q.label}</span>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-center gap-2 border-t border-border/50 bg-background/40 px-3 py-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Speak freely…"
              disabled={streaming}
              className="h-11 flex-1 rounded-xl border border-border/60 bg-background/70 px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-foreground/10 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!draft.trim() || streaming}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background transition hover:opacity-95 disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </form>
        </div>
      </FadeIn>
    </SenecaScreen>
  );
}
