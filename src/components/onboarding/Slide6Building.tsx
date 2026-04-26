import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

const subTasks = [
  "Analyzing your behavior",
  "Structuring your control rules",
  "Calibrating discipline system",
];

export default function Slide6Building(_props: SlideProps) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((p) => Math.min(p + 2.5, 100));
    }, 90);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress > 33 && stepIdx < 1) setStepIdx(1);
    if (progress > 66 && stepIdx < 2) setStepIdx(2);
    if (progress >= 100 && stepIdx < 3) setStepIdx(3);
  }, [progress, stepIdx]);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Visual: nodes & particles */}
      <div className="relative h-[260px] w-full">
        {/* Particles */}
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-gradient-mix"
            style={{
              left: `${(i * 37) % 95}%`,
              top: `${(i * 53) % 90}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 1, 0],
              scale: [0.6, 1.4, 0.6],
            }}
            transition={{
              duration: 2.5 + (i % 3),
              repeat: Infinity,
              delay: (i % 5) * 0.3,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Connection web */}
        <svg
          viewBox="0 0 320 260"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="b-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" />
              <stop offset="100%" stopColor="#00C6FF" />
            </linearGradient>
          </defs>
          {[
            { d: "M60 60 L 160 130", del: 0 },
            { d: "M260 60 L 160 130", del: 0.2 },
            { d: "M160 130 L 80 210", del: 0.4 },
            { d: "M160 130 L 240 210", del: 0.6 },
            { d: "M60 60 L 260 60", del: 0.8 },
          ].map((p, i) => (
            <motion.path
              key={i}
              d={p.d}
              stroke="url(#b-line)"
              strokeWidth="1.5"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ delay: p.del, duration: 1.2, repeat: Infinity, repeatType: "reverse", repeatDelay: 0.6 }}
            />
          ))}
        </svg>

        {/* Nodes */}
        {[
          { x: 60, y: 60, size: 12, color: "#A29BFE", del: 0 },
          { x: 260, y: 60, size: 14, color: "#00C6FF", del: 0.3 },
          { x: 80, y: 210, size: 11, color: "#FF7AF5", del: 0.6 },
          { x: 240, y: 210, size: 13, color: "#6C5CE7", del: 0.8 },
        ].map((n, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: n.x - n.size,
              top: n.y - n.size,
              width: n.size * 2,
              height: n.size * 2,
              background: n.color,
              boxShadow: `0 0 24px ${n.color}`,
            }}
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: n.del,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Center core */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-glow rounded-full bg-gradient-mix opacity-50 blur-2xl" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-mix p-[2px]"
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-card">
                <span className="text-gradient-mix text-[16px] font-bold">
                  {Math.floor(progress)}%
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="w-full text-center">
        <h1 className="text-[24px] font-bold leading-[1.15] tracking-tight text-text-primary">
          Building your{" "}
          <span className="text-gradient-primary">decision system...</span>
        </h1>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="h-2 w-full overflow-hidden rounded-full bg-text-secondary/15">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
            className="h-full bg-gradient-mix"
            style={{
              backgroundSize: "200% 100%",
              backgroundImage:
                "linear-gradient(90deg, #6C5CE7, #00C6FF, #FF7AF5, #6C5CE7)",
              animation: "shimmer 2s linear infinite",
            }}
          />
        </div>

        <div className="mt-4 space-y-2.5">
          {subTasks.map((task, i) => {
            const done = stepIdx > i;
            const active = stepIdx === i;
            return (
              <motion.div
                key={task}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: active || done ? 1 : 0.45, x: 0 }}
                className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-soft ring-1 ring-border"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                    done
                      ? "bg-gradient-primary"
                      : active
                        ? "bg-gradient-mix animate-pulse-glow"
                        : "bg-text-secondary/15"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4 text-white" strokeWidth={3} />
                  ) : active ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-text-secondary/40" />
                  )}
                </div>
                <span className="text-[13px] font-medium text-text-primary">
                  {task}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
