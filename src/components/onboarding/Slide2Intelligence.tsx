import { motion } from "framer-motion";
import { AlertTriangle, Check, Repeat } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 2 — Behavior tracking
 * "SenecaEdge tracks your decisions… Not just your setup. Your behavior."
 */
export default function Slide2Intelligence(_props: SlideProps) {
  const cards = [
    {
      label: "Trade taken",
      sub: "EUR/USD · 09:42",
      icon: <Check className="h-4 w-4" />,
      tone: "primary" as const,
      x: "-translate-x-[55%]",
      delay: 0.2,
    },
    {
      label: "Rule broken",
      sub: "Risk > 1.5%",
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: "pink" as const,
      x: "translate-x-[55%]",
      delay: 0.6,
    },
    {
      label: "Overtrade detected",
      sub: "5 trades / hour",
      icon: <Repeat className="h-4 w-4" />,
      tone: "cyan" as const,
      x: "-translate-x-[35%] translate-y-[140px]",
      delay: 1.0,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative h-[320px] w-full">
        {/* Connection lines from cards to center node */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 360 320"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="s2-conn" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#00C6FF" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {[
            { d: "M70 60 Q 140 130 180 170", del: 1.4 },
            { d: "M290 60 Q 220 130 180 170", del: 1.6 },
            { d: "M110 280 Q 150 230 180 200", del: 1.8 },
          ].map((p, i) => (
            <motion.path
              key={i}
              d={p.d}
              stroke="url(#s2-conn)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 6"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: p.del, duration: 0.9, ease: "easeOut" }}
            />
          ))}
        </svg>

        {/* Floating cards */}
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 24, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: c.delay,
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={`absolute left-1/2 top-2 ${c.x}`}
            style={i === 2 ? { top: "auto", bottom: 0 } : undefined}
          >
            <BehaviorCard {...c} />
          </motion.div>
        ))}

        {/* Central AI node */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 1.7,
            type: "spring",
            stiffness: 220,
            damping: 18,
          }}
          className="absolute left-1/2 top-[170px] -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-glow rounded-full bg-gradient-mix opacity-60 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-mix shadow-glow-primary">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card">
                <span className="text-gradient-mix text-[14px] font-bold">
                  AI
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-[24px] font-bold leading-[1.2] tracking-tight text-text-primary">
          SenecaEdge tracks your decisions…
        </h1>
        <p className="mt-2 text-[18px] font-semibold text-text-secondary">
          Not just your setup.
        </p>
        <p className="mt-1 text-[22px] font-bold text-gradient-primary">
          Your behavior.
        </p>
      </motion.div>
    </div>
  );
}

function BehaviorCard({
  label,
  sub,
  icon,
  tone,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  tone: "primary" | "cyan" | "pink";
}) {
  const glow =
    tone === "primary"
      ? "shadow-glow-primary"
      : tone === "cyan"
        ? "shadow-glow-cyan"
        : "shadow-glow-pink";
  const iconBg =
    tone === "primary"
      ? "bg-gradient-primary"
      : tone === "cyan"
        ? "bg-gradient-accent"
        : "bg-gradient-flash";
  return (
    <div
      className={`glass-strong animate-float-mid flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ${glow}`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl text-white ${iconBg}`}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <div className="text-[12px] font-bold text-text-primary">{label}</div>
        <div className="text-[10px] font-medium text-text-secondary">
          {sub}
        </div>
      </div>
    </div>
  );
}
