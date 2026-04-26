import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * AI Mentor preview — auto-advance narrative slide.
 * Shows a chat UI mockup with mentor responses to make the product feel alive.
 */
export default function SlideMentor(_props: SlideProps) {
  const messages = [
    { side: "user", text: "I just broke my rule again." },
    {
      side: "ai",
      text: "You're reacting emotionally. Step back. Breathe. Re-check your plan.",
    },
    { side: "user", text: "Is this a good entry?" },
    {
      side: "ai",
      text: "Wait for confirmation. Your setup isn't complete yet.",
    },
  ] as const;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header copy first */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
          <Sparkles className="h-3 w-3 text-brand" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            AI Mentor
          </span>
        </div>
        <h1 className="mt-3 text-[24px] font-bold leading-[1.2] tracking-tight text-text-primary">
          Talk to your{" "}
          <span className="text-gradient-mix">AI trading mentor.</span>
        </h1>
        <p className="mt-2 text-[14px] leading-[1.5] text-text-secondary">
          Ask questions. Vent. Get clarity in real time.
        </p>
      </motion.div>

      {/* Chat mockup card */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="relative w-full overflow-hidden rounded-3xl bg-card p-4 shadow-card-premium ring-1 ring-border"
      >
        {/* Mentor header inside chat */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-mix shadow-glow-primary">
            <Sparkles className="h-4 w-4 text-white" />
            <motion.span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-card"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-text-primary">
              SenecaEdge Mentor
            </div>
            <div className="text-[10px] font-medium text-emerald-500">
              online · listening
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="mt-3 space-y-2.5">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.45, duration: 0.4 }}
              className={`flex ${m.side === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2 text-[12.5px] leading-[1.4] ${
                  m.side === "user"
                    ? "rounded-br-md bg-secondary text-text-primary"
                    : "rounded-bl-md bg-gradient-mix text-white shadow-glow-primary"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 + messages.length * 0.45, duration: 0.4 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-secondary px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-brand"
                  animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
