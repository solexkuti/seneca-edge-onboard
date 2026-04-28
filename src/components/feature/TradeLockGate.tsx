// TradeLockGate — wraps any trade-related surface (Chart Analyzer, Journal,
// Trade Gate) with a hard lock. If the user has not confirmed today's
// checklist (or has been re-locked), it renders a full-screen overlay
// instead of the children. No bypass.

import { Link } from "@tanstack/react-router";
import { Lock, ShieldAlert, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTradeLock } from "@/hooks/useTradeLock";

type Props = {
  children: React.ReactNode;
  /** Friendly name of the surface being gated (e.g. "Chart Analyzer"). */
  surface?: string;
};

export default function TradeLockGate({ children, surface = "Trading" }: Props) {
  const { state, loading } = useTradeLock();

  if (loading || !state) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.trade_lock) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[560px] items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full rounded-2xl bg-card p-7 ring-1 ring-border shadow-card-premium"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/10 ring-1 ring-red-600/20">
            <Lock className="h-5 w-5 text-red-700" aria-hidden />
          </div>

          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-700">
            {surface} Locked
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Trading Locked
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            {state.message}
          </p>

          {state.reason === "consecutive_breaks" && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-600/5 p-3 ring-1 ring-red-600/20">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-red-700" aria-hidden />
              <p className="text-xs text-red-900/85">
                You broke discipline twice in a row after confirming today.
                The system is forcing a reset before you trade again.
              </p>
            </div>
          )}

          {state.reason === "out_of_control_unacked" && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/5 p-3 ring-1 ring-amber-500/20">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-amber-700" aria-hidden />
              <p className="text-xs text-amber-900/85">
                Strict mode is active. You must explicitly accept the
                extra commitment before trading is unlocked.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/hub/daily"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-95"
            >
              Review Checklist <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/hub"
              className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs text-muted-foreground hover:text-foreground"
            >
              Back to Hub
            </Link>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            This is not optional. You cannot trade impulsively — review your
            state, your rules, and commit before the system unlocks.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
