// TraderStateGate — central enforcement of the three hard-block conditions:
//   1. no_strategy        → must build a strategy first
//   2. not_confirmed      → must confirm today's checklist
//   3. discipline_locked  → discipline score < 50, forced cooldown
//
// Every trading surface (Chart Analyzer, Trade Gate, Journal logging) must
// wrap its content in this gate. There is no bypass.

import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Lock, ShieldAlert, ArrowRight, Loader2, Target } from "lucide-react";
import { motion } from "framer-motion";
import { useTraderState } from "@/hooks/useTraderState";

type Block =
  | "loading"
  | "no_strategy"
  | "not_confirmed"
  | "discipline_locked"
  | "ok";

type Props = {
  children: React.ReactNode;
  surface?: string;
  /**
   * Which hard blocks this surface enforces. Default = all three.
   * Daily checklist itself only enforces `no_strategy`.
   */
  enforce?: Array<"no_strategy" | "not_confirmed" | "discipline_locked">;
};

export default function TraderStateGate({
  children,
  surface = "Trading",
  enforce = ["no_strategy", "not_confirmed", "discipline_locked"],
}: Props) {
  const { state } = useTraderState();
  const navigate = useNavigate();

  // Hard redirect: no strategy → builder. Per spec, this is not a soft block.
  useEffect(() => {
    if (
      !state.loading &&
      enforce.includes("no_strategy") &&
      state.blocks.no_strategy
    ) {
      void navigate({ to: "/hub/strategy/new", replace: true });
    }
  }, [state.loading, state.blocks.no_strategy, enforce, navigate]);

  let block: Block = "ok";
  if (state.loading) block = "loading";
  else if (enforce.includes("no_strategy") && state.blocks.no_strategy)
    block = "no_strategy";
  else if (enforce.includes("not_confirmed") && state.blocks.not_confirmed)
    block = "not_confirmed";
  else if (
    enforce.includes("discipline_locked") &&
    state.blocks.discipline_locked
  )
    block = "discipline_locked";

  if (block === "loading") {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (block === "ok") return <>{children}</>;

  const COPY: Record<Exclude<Block, "loading" | "ok">, {
    eyebrow: string;
    title: string;
    body: string;
    cta: { label: string; to: string };
    icon: typeof Lock;
    tone: "red" | "amber" | "indigo";
  }> = {
    no_strategy: {
      eyebrow: `${surface} unavailable`,
      title: "Build your strategy first.",
      body: "Every module in SenecaEdge runs against your defined rules. You must lock a strategy before the system will let you analyze charts, log trades, or run the daily checklist.",
      cta: { label: "Open Strategy Builder", to: "/hub/strategy" },
      icon: Target,
      tone: "indigo",
    },
    not_confirmed: {
      eyebrow: `${surface} locked`,
      title: "Confirm today's checklist.",
      body:
        state.session.trade_lock?.message ??
        "You have not confirmed your checklist for today.",
      cta: { label: "Review Checklist", to: "/hub/daily" },
      icon: Lock,
      tone: "red",
    },
    discipline_locked: {
      eyebrow: `${surface} locked`,
      title: "Discipline lock engaged.",
      body: `Your rolling discipline score has dropped to ${state.discipline.score}/100. The system is forcing a cooldown. Re-confirm your checklist with a clean head before trading again.`,
      cta: { label: "Reset via Checklist", to: "/hub/daily" },
      icon: ShieldAlert,
      tone: "red",
    },
  };

  const c = COPY[block];
  const toneRing =
    c.tone === "red"
      ? "bg-red-600/10 ring-red-600/20 text-red-700"
      : c.tone === "amber"
        ? "bg-amber-500/10 ring-amber-500/20 text-amber-700"
        : "bg-indigo-500/10 ring-indigo-500/20 text-indigo-700";

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
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${toneRing}`}
          >
            <c.icon className="h-5 w-5" aria-hidden />
          </div>

          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {c.eyebrow}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {c.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            {c.body}
          </p>

          {block === "discipline_locked" && (
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 ring-1 ring-border">
              <Stat label="Score" value={`${state.discipline.score}`} />
              <Stat
                label="State"
                value={state.discipline.state.replace("_", " ")}
              />
              <Stat
                label="Streak"
                value={`${state.discipline.consecutive_breaks} break${state.discipline.consecutive_breaks === 1 ? "" : "s"}`}
              />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to={c.cta.to}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-95"
            >
              {c.cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/hub"
              className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs text-muted-foreground hover:text-foreground"
            >
              Back to Hub
            </Link>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            SenecaEdge is a decision enforcement system. You cannot bypass this gate —
            the entire system reads from the same TRADER_STATE.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold capitalize text-foreground">
        {value}
      </div>
    </div>
  );
}
