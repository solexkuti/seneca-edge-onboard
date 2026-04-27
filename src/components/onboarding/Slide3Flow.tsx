import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, LineChart, ClipboardList, ArrowRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 5 — Get Started (Decision Point)
 *
 * User picks a starting path. We persist the choice, show a brief
 * "Got it. Let's start with that." confirmation, then route directly
 * into the chosen flow. No feature recap. No more mockups.
 */

type StartPath = "learn" | "review" | "plan";

type PathOption = {
  id: StartPath;
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string;
  iconBg: string;
  route: "/hub" | "/hub/chart" | "/hub/strategy";
};

const PATHS: PathOption[] = [
  {
    id: "learn",
    icon: BookOpen,
    title: "Learn the basics",
    desc: "Start with structure, risk, and the mindset behind every trade.",
    accent: "text-accent-blue",
    iconBg: "bg-accent-blue/10 ring-accent-blue/20",
    route: "/hub",
  },
  {
    id: "review",
    icon: LineChart,
    title: "Review my trades",
    desc: "Bring a recent setup. We'll break it down step by step.",
    accent: "text-accent-cyan",
    iconBg: "bg-accent-cyan/10 ring-accent-cyan/20",
    route: "/hub/chart",
  },
  {
    id: "plan",
    icon: ClipboardList,
    title: "Build my plan",
    desc: "Define your rules so every trade runs through them first.",
    accent: "text-brand",
    iconBg: "bg-brand/10 ring-brand/20",
    route: "/hub/strategy",
  },
];

const STORAGE_KEY = "seneca_start_path";

export default function Slide3Flow(_: SlideProps) {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<PathOption | null>(null);

  const choose = (p: PathOption) => {
    if (chosen) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, p.id);
    } catch {
      // non-blocking
    }
    setChosen(p);
    // Brief confirmation, then route into the chosen flow.
    window.setTimeout(() => {
      navigate({ to: p.route });
    }, 650);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-7 px-2">
      <AnimatePresence mode="wait">
        {!chosen ? (
          <motion.div
            key="picker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex w-full flex-col items-center gap-7"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
                Get started
              </p>
              <h1 className="mt-2 text-[26px] font-bold leading-[1.2] tracking-tight text-text-primary">
                Where do you want to begin?
              </h1>
              <p className="mt-2 text-[13.5px] leading-snug text-text-secondary">
                Pick a path. You can switch anytime.
              </p>
            </motion.div>

            {/* Path picker */}
            <div className="flex w-full flex-col gap-2.5">
              {PATHS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <motion.button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: 0.15 + i * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    className="interactive-glow group flex w-full items-center gap-3.5 rounded-2xl bg-card p-3.5 text-left ring-1 ring-border shadow-soft transition-colors hover:ring-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
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
          </motion.div>
        ) : (
          /* Confirmation pause — short, then route */
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 py-10 text-center"
          >
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-mix shadow-soft"
            >
              <Check className="h-7 w-7 text-white" strokeWidth={2.6} />
            </motion.span>
            <div>
              <p className="text-[18px] font-bold text-text-primary">
                Got it.
              </p>
              <p className="mt-1 text-[14px] text-text-secondary">
                Let's start with{" "}
                <span className="font-semibold text-text-primary">
                  {chosen.title.toLowerCase()}
                </span>
                .
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
