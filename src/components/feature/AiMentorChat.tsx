import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import FeatureShell from "./FeatureShell";
import { useJournal } from "@/hooks/useJournal";
import { summarizeJournal } from "@/lib/journalSummary";
import { toast } from "sonner";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type MentorMode = "standard" | "strict" | "beginner" | "breakdown";

const MODES: { id: MentorMode; label: string; hint: string }[] = [
  { id: "standard", label: "Standard", hint: "Balanced & structured" },
  { id: "strict", label: "Strict", hint: "Blunt corrections" },
  { id: "beginner", label: "Beginner", hint: "Fundamentals only" },
  { id: "breakdown", label: "Breakdown", hint: "Deeper structured teaching" },
];

const SUGGESTIONS = [
  "What is market structure?",
  "How should I size my risk per trade?",
  "I keep losing after a win. Why?",
  "I want to revenge trade right now.",
];

const MENTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`;

export default function AiMentorChat() {
  const journal = useJournal();
  const [mode, setMode] = useState<MentorMode>("standard");
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "I'm Seneca. Ask me about market structure, risk, psychology, or execution. I won't give you signals — I'll help you build the discipline to find your own.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    // Build user context (only real data)
    const journalSummary = summarizeJournal(journal) ?? undefined;
    const ctx =
      journalSummary
        ? { journalSummary }
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
        body: JSON.stringify({ messages: wireMessages, context: ctx }),
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
      subtitle="A disciplined trading mentor. Honest, structured, and aware of how you trade."
    >
      <div className="flex h-[calc(100svh-220px)] min-h-[480px] flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-soft">
        {/* Mentor identity */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-mix shadow-glow-primary">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.2} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">Seneca</p>
            <p className="text-[11px] text-text-secondary">
              {journal.length > 0
                ? `Aware of your last ${Math.min(journal.length, 10)} trades`
                : "No journal data — answers will be general"}
            </p>
          </div>
        </div>

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

        {/* Suggestion chips (only before first user message) */}
        {messages.length === 1 ? (
          <div className="border-t border-border/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
              Try asking
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={streaming}
                  className="rounded-full bg-text-primary/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-text-primary ring-1 ring-border transition-all hover:bg-text-primary/[0.08] disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
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
