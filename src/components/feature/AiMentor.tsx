import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import FeatureShell from "./FeatureShell";

type Msg = {
  id: string;
  role: "mentor" | "user";
  text: string;
};

const suggestions = [
  "I want to enter now.",
  "Is this a good entry?",
  "I just lost. Should I trade again?",
  "Review my last setup.",
];

const scriptedReplies: Record<string, string> = {
  "I want to enter now.":
    "Step back. What confirmation are you waiting for? If you can't name it, the trade isn't valid yet.",
  "Is this a good entry?":
    "Wait for confirmation. Your setup isn't complete — price hasn't retested the level you marked.",
  "I just lost. Should I trade again?":
    "Not yet. Take 15 minutes. Revenge trades break more accounts than bad setups ever do.",
  "Review my last setup.":
    "You entered before the retest and skipped your invalidation. Solid bias, weak execution. Tag this trade as 'early entry'.",
};

const defaultReply =
  "Got it. Stay with your plan. If the setup isn't on your checklist, the answer is no.";

export default function AiMentor() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m0",
      role: "mentor",
      text: "I'm here to keep you sharp. Ask me anything before, during, or after a trade.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setTyping(true);
    window.setTimeout(() => {
      const reply = scriptedReplies[trimmed] ?? defaultReply;
      setMessages((m) => [
        ...m,
        { id: `m-${Date.now()}`, role: "mentor", text: reply },
      ]);
      setTyping(false);
    }, 1100);
  };

  return (
    <FeatureShell
      eyebrow="AI Mentor"
      title="Your second voice."
      subtitle="Real-time guidance when pressure tries to break you."
    >
      <div className="flex h-[calc(100svh-220px)] min-h-[460px] flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-soft">
        {/* Mentor identity */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-mix shadow-glow-primary">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.2} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">
              Seneca
            </p>
            <p className="text-[11px] text-text-secondary">
              Online · Discipline-trained
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
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[82%] rounded-2xl rounded-br-md bg-gradient-primary px-3.5 py-2.5 text-[13.5px] leading-snug text-white shadow-glow-primary"
                      : "max-w-[82%] rounded-2xl rounded-bl-md bg-text-primary/[0.04] px-3.5 py-2.5 text-[13.5px] leading-snug text-text-primary ring-1 ring-border"
                  }
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
            {typing ? (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-text-primary/[0.04] px-3.5 py-3 ring-1 ring-border">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-text-secondary"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{
                        duration: 1.1,
                        repeat: Infinity,
                        delay: i * 0.18,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Suggestion chips */}
        {messages.length <= 1 ? (
          <div className="border-t border-border/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
              Try asking
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full bg-text-primary/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-text-primary ring-1 ring-border transition-all hover:bg-text-primary/[0.08]"
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
            className="h-10 flex-1 rounded-xl bg-text-primary/[0.04] px-3.5 text-[14px] text-text-primary placeholder:text-text-secondary/70 ring-1 ring-border focus:outline-none focus:ring-brand/40"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
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
