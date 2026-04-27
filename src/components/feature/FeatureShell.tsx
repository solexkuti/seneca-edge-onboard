import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function FeatureShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[420px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(108,92,231,0.22), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[440px] px-5 pt-6 pb-10">
        {/* Top nav */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between"
        >
          <Link
            to="/hub"
            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border shadow-soft transition-all hover:shadow-card-premium"
            aria-label="Back to Control Hub"
          >
            <ArrowLeft
              className="h-4 w-4 text-text-primary transition-transform group-hover:-translate-x-0.5"
              strokeWidth={2.2}
            />
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80">
            {eyebrow}
          </span>
          <span className="h-10 w-10" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4"
        >
          <h1 className="text-[26px] font-bold leading-[1.1] tracking-tight text-text-primary">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-[13.5px] leading-snug text-text-secondary">
              {subtitle}
            </p>
          ) : null}
        </motion.div>

        {/* Content */}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
