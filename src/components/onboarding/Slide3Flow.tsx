import { motion } from "framer-motion";
import { BookOpen, LineChart, ClipboardList, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 3 — Get Started: pick your path
 *
 * The user chooses how they want to begin. The choice is persisted so the
 * rest of the app can tailor what surfaces first (lessons, trade review, or
 * plan-building). Slide does NOT auto-advance — the user must choose.
 */

type StartPath = "learn" | "review" | "plan";

type PathOption = {
  id: StartPath;
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string; // tailwind text-color class for icon
  iconBg: string; // tailwind bg class for icon container
};

const PATHS: PathOption[] = [
  {
    id: "learn",
    icon: BookOpen,
    title: "Learn the basics",
    desc: "Start with structure, risk, and the mindset behind every trade.",
    accent: "text-accent-blue",
    iconBg: "bg-accent-blue/10 ring-accent-blue/20",
  },
  {
    id: "review",
    icon: LineChart,
    title: "Review my trades",
    desc: "Bring a recent setup. We'll break it down step by step.",
    accent: "text-accent-cyan",
    iconBg: "bg-accent-cyan/10 ring-accent-cyan/20",
  },
  {
    id: "plan",
    icon: ClipboardList,
    title: "Build my plan",
    desc: "Define your rules so every trade runs through them first.",
    accent: "text-brand",
    iconBg: "bg-brand/10 ring-brand/20",
  },
];

const STORAGE_KEY = "seneca_start_path";

export default function Slide3Flow({ onNext }: SlideProps) {
  const choose = (path: StartPath) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, path);
    } catch {
      // ignore — non-blocking
    }
    onNext();
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-7 px-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          Get started
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-[1.2] tracking-tight text-text-primary">
          Where do you want to begin?
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-text-secondary">
          Pick a path. You can switch any time —{" "}
          <span className="text-text-primary">this just sets your first step.</span>
        </p>
      </motion.div>

      {/* Path picker buttons */}
      <div className="flex w-full flex-col gap-2.5">
        {PATHS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.15 + i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              className="group flex w-full items-center gap-3.5 rounded-2xl bg-card p-3.5 text-left ring-1 ring-border shadow-soft transition-colors hover:ring-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${p.iconBg}`}
              >
                <Icon className={`h-5 w-5 ${p.accent}`} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-text-primary">
                  {p.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-text-secondary">
                  {p.desc}
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-text-secondary/60 transition-all group-hover:translate-x-0.5 group-hover:text-brand"
                strokeWidth={2.2}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Skip */}
      <motion.button
        type="button"
        onClick={() => onNext()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="text-[12px] font-medium text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
      >
        Not sure yet — skip for now
      </motion.button>
    </div>
  );
}
