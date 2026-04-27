import { motion } from "framer-motion";
import { Construction } from "lucide-react";
import FeatureShell from "./FeatureShell";

export default function ComingSoonScreen({
  eyebrow,
  title,
  subtitle,
  description,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  description: string;
}) {
  return (
    <FeatureShell eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl bg-card p-6 ring-1 ring-border shadow-soft"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(108,92,231,0.35), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-mix shadow-glow-primary">
            <Construction className="h-6 w-6 text-white" strokeWidth={2.2} />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-gradient-mix">
            In construction
          </p>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight text-text-primary">
            We're calibrating this module.
          </h2>
          <p className="mt-2 max-w-[300px] text-[13px] leading-snug text-text-secondary">
            {description}
          </p>
        </div>
      </motion.div>
    </FeatureShell>
  );
}
