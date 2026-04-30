import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

// FeatureShell — page wrapper used by feature routes (Journal, State, Mind,
// Recovery, Strategy, Trades, Stats, etc.). The outer hub layout already
// provides sidebar + topbar chrome, so this component now produces a clean
// centered content column with consistent typography.
export default function FeatureShell({
  eyebrow,
  title,
  subtitle,
  children,
  back = "/hub",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-8 md:py-10">
      {/* Top nav */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between"
      >
        <Link
          to={back}
          className="group inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-text-primary"
          aria-label="Back"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            strokeWidth={2.2}
          />
          Back
        </Link>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">
          {eyebrow}
        </span>
        <span className="h-7 w-7" />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6"
      >
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-text-primary md:text-[32px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-text-secondary">
            {subtitle}
          </p>
        ) : null}
      </motion.div>

      {/* Content */}
      <div className="mt-8">{children}</div>
    </div>
  );
}
