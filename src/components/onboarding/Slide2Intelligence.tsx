import { motion } from "framer-motion";
import { AlertTriangle, Check, Repeat } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 2 — Behavior tracking
 * Text-first layout. Cards appear AFTER text is fully visible and stay
 * outside the central text area so nothing overlaps the message.
 */
export default function Slide2Intelligence(_props: SlideProps) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Soft scene background: white → light purple/blue with faint scan field */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-[560px]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(108,92,231,0.10),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(0,198,255,0.10),transparent_60%)]" />
        <ScanField />
        <Particles />
      </div>

      {/* Stage */}
      <div className="relative h-[440px] w-full">
        {/* Connection lines from AI node to each card */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 360 440"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="s2-conn" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#00C6FF" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          {/* Top-right: Trade taken */}
          <motion.path
            d="M180 240 Q 240 150 310 70"
            stroke="url(#s2-conn)"
            strokeWidth="1.4"
            fill="none"
            strokeDasharray="3 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            transition={{ delay: 2.2, duration: 0.7, ease: "easeOut" }}
          />
          {/* Top-left: Rule broken */}
          <motion.path
            d="M180 240 Q 110 160 50 70"
            stroke="url(#s2-conn)"
            strokeWidth="1.4"
            fill="none"
            strokeDasharray="3 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            transition={{ delay: 2.7, duration: 0.7, ease: "easeOut" }}
          />
          {/* Bottom: Overtrade */}
          <motion.path
            d="M180 240 Q 180 320 180 400"
            stroke="url(#s2-conn)"
            strokeWidth="1.4"
            fill="none"
            strokeDasharray="3 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            transition={{ delay: 3.2, duration: 0.7, ease: "easeOut" }}
          />
        </svg>

        {/* Centered text — appears first, stays unobstructed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-[160px] z-20 w-[280px] -translate-x-1/2 text-center"
        >
          <h1 className="text-[22px] font-bold leading-[1.25] tracking-tight text-text-primary">
            SenecaEdge tracks your decisions…
          </h1>
          <p className="mt-2 text-[16px] font-semibold text-text-secondary">
            Not just your setup.
          </p>
          <p className="mt-1 text-[22px] font-bold text-gradient-primary">
            Your behavior.
          </p>
        </motion.div>

        {/* AI node — sits just below the text block */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 1.4,
            type: "spring",
            stiffness: 220,
            damping: 18,
          }}
          className="absolute left-1/2 top-[300px] z-10 -translate-x-1/2"
        >
          <AINode />
        </motion.div>

        {/* Top-right card */}
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.9, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-1 top-3 z-10"
        >
          <BehaviorCard
            label="Trade taken"
            sub="EUR/USD · 09:42"
            icon={<Check className="h-3.5 w-3.5" />}
            tone="primary"
          />
        </motion.div>

        {/* Top-left card */}
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 2.4, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1 top-3 z-10"
        >
          <BehaviorCard
            label="Rule broken"
            sub="Risk > 1.5%"
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            tone="pink"
          />
        </motion.div>

        {/* Bottom card — most important */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 2.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2"
        >
          <BehaviorCard
            label="Overtrade detected"
            sub="5 trades / hour"
            icon={<Repeat className="h-3.5 w-3.5" />}
            tone="cyan"
            emphasis
          />
        </motion.div>
      </div>
    </div>
  );
}

function AINode() {
  return (
    <div className="relative">
      {/* Outer scan ring */}
      <motion.div
        className="absolute inset-0 -m-4 rounded-full border border-brand/30"
        animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut" }}
      />
      <div className="absolute inset-0 animate-pulse-glow rounded-full bg-gradient-mix opacity-50 blur-xl" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-mix shadow-glow-primary">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <span className="text-gradient-mix text-[12px] font-bold">AI</span>
        </div>
      </div>
    </div>
  );
}

function BehaviorCard({
  label,
  sub,
  icon,
  tone,
  emphasis,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  tone: "primary" | "cyan" | "pink";
  emphasis?: boolean;
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
      className={`glass-strong animate-float-mid flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ${glow} ${
        emphasis ? "ring-1 ring-brand/30" : ""
      }`}
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

function ScanField() {
  return (
    <div className="absolute left-1/2 top-[210px] -translate-x-1/2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/15"
          animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.25, 0.05, 0.25] }}
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.9,
          }}
        />
      ))}
    </div>
  );
}

function Particles() {
  const dots = [
    { x: "10%", y: "12%", d: 0 },
    { x: "85%", y: "18%", d: 0.6 },
    { x: "20%", y: "70%", d: 1.2 },
    { x: "78%", y: "62%", d: 0.3 },
    { x: "50%", y: "8%", d: 0.9 },
    { x: "45%", y: "88%", d: 1.5 },
    { x: "92%", y: "44%", d: 0.4 },
    { x: "6%", y: "48%", d: 1.1 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden">
      {dots.map((p, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-gradient-mix opacity-60"
          style={{ left: p.x, top: p.y }}
          animate={{ y: [0, -10, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{
            duration: 5 + (i % 3),
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.d,
          }}
        />
      ))}
    </div>
  );
}
