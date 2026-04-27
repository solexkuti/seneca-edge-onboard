import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Activity,
  BookOpenCheck,
  Sparkles,
  LayoutTemplate,
  Gamepad2,
  ArrowUpRight,
  Lock,
  ShieldCheck,
  Eye,
} from "lucide-react";
import {
  BEHAVIOR_STATES,
  CHART_DESCRIPTIONS,
  MOCK_METRICS,
  deriveBehaviorState,
  pickRandom,
  type BehaviorStateKey,
} from "@/lib/behaviorState";
import CheckHistorySparkline from "./CheckHistorySparkline";
import Logo from "@/components/brand/Logo";

type CoreFeature = {
  key: string;
  title: string;
  text: string;
  Icon: typeof LineChart;
  tone: "violet" | "cyan" | "pink" | "blue" | "mint";
  to: "/hub/mind" | "/hub/chart" | "/hub/state" | "/hub/journal" | "/hub/mentor";
  primary?: boolean;
};

const upcomingFeatures = [
  {
    key: "strategy",
    title: "Strategy Builder",
    text: "Structure and refine your trading system.",
    Icon: LayoutTemplate,
  },
  {
    key: "sim",
    title: "Simulator",
    text: "Train your decisions in controlled scenarios.",
    Icon: Gamepad2,
  },
];

const toneStyles: Record<
  CoreFeature["tone"],
  { iconBg: string; glow: string; ring: string }
> = {
  violet: {
    iconBg: "from-[#6C5CE7] to-[#A29BFE]",
    glow: "shadow-[0_18px_40px_-22px_rgba(108,92,231,0.65)]",
    ring: "group-hover:ring-[#6C5CE7]/30",
  },
  cyan: {
    iconBg: "from-[#00C6FF] to-[#0072FF]",
    glow: "shadow-[0_22px_50px_-20px_rgba(0,198,255,0.65)]",
    ring: "group-hover:ring-[#00C6FF]/40",
  },
  pink: {
    iconBg: "from-[#FF7AF5] to-[#6C5CE7]",
    glow: "shadow-[0_18px_40px_-22px_rgba(255,122,245,0.55)]",
    ring: "group-hover:ring-[#FF7AF5]/30",
  },
  blue: {
    iconBg: "from-[#4F8CFF] to-[#6C5CE7]",
    glow: "shadow-[0_18px_40px_-22px_rgba(79,140,255,0.55)]",
    ring: "group-hover:ring-[#4F8CFF]/30",
  },
  mint: {
    iconBg: "from-[#00C6FF] to-[#6C5CE7]",
    glow: "shadow-[0_18px_40px_-22px_rgba(108,92,231,0.55)]",
    ring: "group-hover:ring-[#00C6FF]/30",
  },
};

export default function ControlHub({ userName }: { userName?: string }) {
  // Behavior state derived from mock metrics
  const stateKey: BehaviorStateKey = useMemo(
    () => deriveBehaviorState(MOCK_METRICS),
    [],
  );
  const state = BEHAVIOR_STATES[stateKey];

  // Rotating insight message — refreshes every 7s
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setMsgIdx((i) => (i + 1) % state.messages.length),
      7000,
    );
    return () => clearInterval(id);
  }, [state.messages.length]);

  // Chart copy rotation — randomized after mount to avoid SSR hydration mismatch
  const [chartCopy, setChartCopy] = useState(CHART_DESCRIPTIONS[0]);
  useEffect(() => {
    setChartCopy(pickRandom(CHART_DESCRIPTIONS));
  }, []);

  const primaryFeature: CoreFeature = {
    key: "chart",
    title: "Chart Analyzer",
    text: chartCopy,
    Icon: LineChart,
    tone: "cyan",
    to: "/hub/chart",
    primary: true,
  };

  const secondaryFeatures: CoreFeature[] = [
    {
      key: "state",
      title: "State Check",
      text: "Mental state scan.",
      Icon: Activity,
      tone: "pink",
      to: "/hub/state",
    },
    {
      key: "journal",
      title: "Trading Journal",
      text: "Behavior patterns.",
      Icon: BookOpenCheck,
      tone: "blue",
      to: "/hub/journal",
    },
    {
      key: "mentor",
      title: "AI Mentor",
      text: "Structured guidance.",
      Icon: Sparkles,
      tone: "mint",
      to: "/hub/mentor",
    },
  ];

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[420px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(108,92,231,0.22), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[440px] px-5 pt-7 pb-12">
        <Header userName={userName} />

        {/* SECTION: Status row (outside card) */}
        <BehaviorStatusRow stateKey={stateKey} />

        {/* SECTION: Message-only card */}
        <BehaviorInsightCard
          stateKey={stateKey}
          message={state.messages[msgIdx]}
          msgIdx={msgIdx}
        />

        {/* SECTION: Primary action */}
        <div className="mt-8">
          <CheckBeforeTradeButton />
        </div>

        {/* SECTION: Check history sparkline */}
        <div className="mt-6">
          <CheckHistorySparkline />
        </div>

        {/* SECTION: Primary tool */}
        <div className="mt-10">
          <SectionLabel>Primary tool</SectionLabel>
          <div className="mt-4">
            <FeatureCard feature={primaryFeature} delay={0} />
          </div>
        </div>

        {/* SECTION: More tools */}
        <div className="mt-10">
          <SectionLabel>More tools</SectionLabel>
          <div className="mt-4 space-y-2.5">
            {secondaryFeatures.map((f, i) => (
              <SecondaryFeatureCard
                key={f.key}
                feature={f}
                delay={0.05 * i}
              />
            ))}
          </div>
        </div>

        {/* SECTION: Upcoming */}
        <div className="mt-10">
          <SectionLabel>Upcoming</SectionLabel>
          <div className="mt-4 grid grid-cols-2 gap-3 opacity-60">
            {upcomingFeatures.map((f, i) => (
              <UpcomingCard key={f.key} feature={f} delay={0.05 * i} />
            ))}
          </div>
        </div>

        {/* SECTION: Recent activity */}
        <div className="mt-10">
          <SectionLabel>Recent activity</SectionLabel>
          <div className="mt-4">
            <RecentActivity />
          </div>
        </div>

        <p className="mt-12 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary/70">
          SenecaEdge · Behavioral system
        </p>
      </div>

      <LiveSignalTicker signals={state.liveSignals} tone={state.tone} />
    </div>
  );
}

function BehaviorStatusRow({ stateKey }: { stateKey: BehaviorStateKey }) {
  const accent = stateAccent[stateKey];
  const state = BEHAVIOR_STATES[stateKey];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mt-7 flex items-center gap-2 text-[11px] font-medium tracking-tight text-text-secondary"
    >
      <span className="font-semibold uppercase tracking-[0.18em] text-text-secondary/80">
        Behavior Insight
      </span>
      <span className="text-text-secondary/40">·</span>
      <span className="flex items-center gap-1.5 text-text-secondary/90">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        Live
      </span>
      <span className="text-text-secondary/40">·</span>
      <span className={`flex items-center gap-1.5 font-semibold ${accent.label}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
        {state.label}
      </span>
    </motion.div>
  );
}

function Header({ userName }: { userName?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start justify-between"
    >
      <div className="min-w-0">
        <Logo size="sm" variant="full" className="mb-3" />
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#22c55e] to-[#00C6FF] shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            System Active
          </span>
        </div>
        <h1 className="mt-1.5 text-[26px] font-bold leading-[1.1] tracking-tight text-text-primary">
          Control Hub
        </h1>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          System is learning your behavior.
        </p>
        {userName && (
          <p className="mt-0.5 text-[12.5px] text-text-primary/80">
            Welcome back,{" "}
            <span className="font-semibold text-text-primary">{userName}</span>.
          </p>
        )}
      </div>

      <div className="relative h-11 w-11 shrink-0 rounded-2xl bg-gradient-primary p-[2px] shadow-glow-primary">
        <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-card">
          <span className="text-[13px] font-semibold text-gradient-mix">
            {userName ? userName.slice(0, 1).toUpperCase() : "S"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const stateAccent: Record<
  BehaviorStateKey,
  { bg: string; dot: string; label: string; glow: string }
> = {
  new: {
    bg: "var(--gradient-mix)",
    dot: "bg-[#94a3b8]",
    label: "text-text-secondary",
    glow: "rgba(108,92,231,0.35)",
  },
  controlled: {
    bg: "linear-gradient(135deg,#22c55e 0%,#00C6FF 100%)",
    dot: "bg-emerald-500",
    label: "text-emerald-600",
    glow: "rgba(34,197,94,0.35)",
  },
  warning: {
    bg: "linear-gradient(135deg,#F59E0B 0%,#FF7AF5 100%)",
    dot: "bg-amber-500",
    label: "text-amber-600",
    glow: "rgba(245,158,11,0.4)",
  },
  danger: {
    bg: "linear-gradient(135deg,#EF4444 0%,#FF7AF5 100%)",
    dot: "bg-red-500",
    label: "text-red-600",
    glow: "rgba(239,68,68,0.45)",
  },
};

function BehaviorInsightCard({
  stateKey,
  message,
  msgIdx,
}: {
  stateKey: BehaviorStateKey;
  message: string;
  msgIdx: number;
}) {
  const accent = stateAccent[stateKey];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative mt-3 overflow-hidden rounded-2xl p-[1.5px]"
      style={{ backgroundImage: accent.bg }}
    >
      <div className="relative rounded-[14px] bg-card px-5 py-5">
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full opacity-40 blur-2xl"
          style={{
            background: `radial-gradient(closest-side, ${accent.glow}, transparent 70%)`,
          }}
        />

        <div className="flex items-start gap-3.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundImage: accent.bg }}
          >
            <Eye className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.p
                key={msgIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="text-[15px] font-medium leading-snug text-text-primary"
              >
                {message}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-text-secondary/10">
          <motion.div
            key={msgIdx}
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 7, ease: "linear" }}
            className="h-full w-1/3"
            style={{ backgroundImage: accent.bg }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function CheckBeforeTradeButton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to="/hub/mind"
        preload="intent"
        className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-mix p-[1.5px] shadow-glow-primary transition-transform active:scale-[0.99]"
      >
        <span className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-mix opacity-30 blur-xl" />
        <div className="relative flex w-full items-center justify-between rounded-[14px] bg-gradient-mix px-5 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.3} />
            </div>
            <div className="text-left">
              <p className="text-[16px] font-semibold tracking-tight text-white">
                Check Before Trade
              </p>
              <p className="text-[12px] text-white/85">
                60-second discipline scan.
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-5 w-5 text-white transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </Link>
    </motion.div>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80 ${className}`}
    >
      <span>{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-text-secondary/20 to-transparent" />
    </div>
  );
}

function SecondaryFeatureCard({
  feature,
  delay,
}: {
  feature: CoreFeature;
  delay: number;
}) {
  const tone = toneStyles[feature.tone];
  const { Icon } = feature;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.99 }}
    >
      <Link
        to={feature.to}
        preload="intent"
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-card/90 px-3.5 py-3 ring-1 ring-border transition-all hover:bg-card hover:shadow-soft"
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tone.iconBg}`}
        >
          <Icon className="h-4 w-4 text-white" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-text-primary">
            {feature.title}
          </h3>
          <p className="truncate text-[11.5px] text-text-secondary">
            {feature.text}
          </p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-secondary/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-primary" />
      </Link>
    </motion.div>
  );
}

function FeatureCard({
  feature,
  delay,
}: {
  feature: CoreFeature;
  delay: number;
}) {
  const tone = toneStyles[feature.tone];
  const { Icon } = feature;
  const isPrimary = !!feature.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      className={isPrimary ? "scale-[1.015]" : ""}
    >
      <Link
        to={feature.to}
        preload="intent"
        className={`group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl bg-card p-3.5 text-left ring-1 ring-border transition-all hover:shadow-card-premium ${tone.ring} ${
          isPrimary
            ? "shadow-[0_22px_55px_-22px_rgba(0,198,255,0.55)] ring-[#00C6FF]/25"
            : ""
        }`}
      >
        {isPrimary && (
          <>
            <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#00C6FF]/15 blur-2xl" />
            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00C6FF]/[0.04] to-transparent" />
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-gradient-mix px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-glow-cyan">
              Primary
            </span>
          </>
        )}
        <div
          className={`relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone.iconBg} ${tone.glow} ${
            isPrimary ? "h-[52px] w-[52px]" : "h-12 w-12"
          }`}
        >
          <Icon
            className={isPrimary ? "h-[22px] w-[22px] text-white" : "h-5 w-5 text-white"}
            strokeWidth={2.2}
          />
          <FeatureMicroAnim featureKey={feature.key} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate font-semibold tracking-tight text-text-primary ${
              isPrimary ? "text-[15.5px]" : "text-[15px]"
            }`}
          >
            {feature.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-text-secondary">
            {feature.text}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-text-secondary/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-primary" />
      </Link>
    </motion.div>
  );
}

function FeatureMicroAnim({ featureKey }: { featureKey: string }) {
  if (featureKey === "chart") {
    return (
      <svg
        viewBox="0 0 48 48"
        className="absolute inset-0 h-full w-full opacity-70"
      >
        <motion.path
          d="M6 32 L18 22 L26 28 L42 14"
          stroke="white"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    );
  }
  if (featureKey === "state") {
    return (
      <motion.span
        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.4, 0.9] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "0 0 8px rgba(255,255,255,0.9)" }}
      />
    );
  }
  if (featureKey === "journal") {
    return (
      <motion.span
        className="absolute bottom-1.5 left-1.5 right-1.5 h-0.5 rounded-full bg-white/70"
        animate={{ scaleX: [0.4, 1, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "left" }}
      />
    );
  }
  if (featureKey === "mentor") {
    return (
      <div className="absolute bottom-1.5 right-1.5 flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1 w-1 rounded-full bg-white"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -1, 0] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.18,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }
  return null;
}

function UpcomingCard({
  feature,
  delay,
}: {
  feature: (typeof upcomingFeatures)[number];
  delay: number;
}) {
  const { Icon } = feature;
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      onClick={() => toast("Coming soon", { description: feature.title })}
      className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-2xl bg-card/80 p-3.5 text-left ring-1 ring-dashed ring-border/80 backdrop-blur"
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={`grid-${feature.key}`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 12 0 L 0 0 0 12"
              fill="none"
              stroke="rgba(108,92,231,0.18)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#grid-${feature.key})`} />
      </svg>

      <div className="relative flex w-full items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-text-secondary/20 to-text-secondary/5 ring-1 ring-border">
          <Icon
            className="h-[18px] w-[18px] text-text-primary/70"
            strokeWidth={2}
          />
        </div>
        <span className="flex items-center gap-1 rounded-full bg-text-primary/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-secondary ring-1 ring-border">
          <Lock className="h-2.5 w-2.5" /> Soon
        </span>
      </div>
      <div className="relative">
        <h3 className="text-[13.5px] font-semibold tracking-tight text-text-primary/90">
          {feature.title}
        </h3>
        <p className="mt-0.5 text-[11.5px] leading-snug text-text-secondary">
          {feature.text}
        </p>
      </div>
    </motion.button>
  );
}

function RecentActivity() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.55 }}
      className="mt-3 rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Last trade
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-text-primary">
            <span className="inline-flex h-5 items-center rounded-md bg-emerald-500/10 px-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600">
              Win
            </span>
            EUR/USD · +0.8R
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Discipline
          </p>
          <p className="mt-1 text-[18px] font-bold text-gradient-mix">72%</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-text-secondary/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "72%" }}
          transition={{ delay: 0.4, duration: 0.9, ease: "easeOut" }}
          className="h-full bg-gradient-mix"
        />
      </div>
    </motion.div>
  );
}

// Floating micro live-feedback ticker — appears every ~12s, fades out.
function LiveSignalTicker({
  signals,
  tone,
}: {
  signals: string[];
  tone: "neutral" | "calm" | "warning" | "danger";
}) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const showCycle = () => {
      if (!mounted) return;
      setVisible(true);
      setTimeout(() => {
        if (!mounted) return;
        setVisible(false);
        setIdx((i) => (i + 1) % signals.length);
      }, 4200);
    };
    // first one after 2s, then every 12s
    const first = setTimeout(showCycle, 2000);
    const id = setInterval(showCycle, 12000);
    return () => {
      mounted = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [signals.length]);

  const toneClass =
    tone === "danger"
      ? "ring-red-500/30 text-red-600 bg-red-50"
      : tone === "warning"
        ? "ring-amber-500/30 text-amber-700 bg-amber-50"
        : tone === "calm"
          ? "ring-emerald-500/25 text-emerald-700 bg-emerald-50"
          : "ring-border text-text-secondary bg-card";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-5">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={`${idx}-${signals[idx]}`}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[11.5px] font-semibold tracking-tight shadow-soft ring-1 backdrop-blur ${toneClass}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            {signals[idx]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
