import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Brain,
  LineChart,
  Activity,
  BookOpenCheck,
  Sparkles,
  LayoutTemplate,
  Gamepad2,
  ArrowUpRight,
  Lock,
} from "lucide-react";

type CoreFeature = {
  key: string;
  title: string;
  text: string;
  Icon: typeof Brain;
  tone: "violet" | "cyan" | "pink" | "blue" | "mint";
  to: "/hub/mind" | "/hub/chart" | "/hub/state" | "/hub/journal" | "/hub/mentor";
};

const coreFeatures: CoreFeature[] = [
  {
    key: "mind",
    title: "Train Your Mind",
    text: "Check your mental state before trading.",
    Icon: Brain,
    tone: "violet",
    to: "/hub/mind",
  },
  {
    key: "chart",
    title: "Chart Analyzer",
    text: "Upload your chart and get insight based on your strategy.",
    Icon: LineChart,
    tone: "cyan",
    to: "/hub/chart",
  },
  {
    key: "state",
    title: "State Check",
    text: "Stay disciplined during live trades.",
    Icon: Activity,
    tone: "pink",
    to: "/hub/state",
  },
  {
    key: "journal",
    title: "Trading Journal",
    text: "Track your trades and discover your patterns.",
    Icon: BookOpenCheck,
    tone: "blue",
    to: "/hub/journal",
  },
  {
    key: "mentor",
    title: "AI Mentor",
    text: "Ask questions and get real-time trading guidance.",
    Icon: Sparkles,
    tone: "mint",
    to: "/hub/mentor",
  },
];

const upcomingFeatures = [
  {
    key: "strategy",
    title: "Strategy Builder",
    text: "Build and structure your trading system with precision.",
    Icon: LayoutTemplate,
  },
  {
    key: "sim",
    title: "Simulator",
    text: "Train your decision-making in simulated trading scenarios.",
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
    glow: "shadow-[0_18px_40px_-22px_rgba(0,198,255,0.55)]",
    ring: "group-hover:ring-[#00C6FF]/30",
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
  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Soft ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[420px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(108,92,231,0.22), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[440px] px-5 pt-7 pb-10">
        {/* TOP — System Status */}
        <Header userName={userName} />

        {/* Today's Focus */}
        <FocusCard />

        {/* Core */}
        <SectionLabel>Core</SectionLabel>
        <div className="mt-3 space-y-3">
          {coreFeatures.map((f, i) => (
            <FeatureCard key={f.key} feature={f} delay={0.05 * i} />
          ))}
        </div>

        {/* Upcoming */}
        <SectionLabel className="mt-7">Upcoming</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {upcomingFeatures.map((f, i) => (
            <UpcomingCard key={f.key} feature={f} delay={0.05 * i} />
          ))}
        </div>

        {/* Recent activity */}
        <SectionLabel className="mt-7">Recent activity</SectionLabel>
        <RecentActivity />

        <p className="mt-8 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary/70">
          SenecaEdge · Decision system
        </p>
      </div>
    </div>
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
      <div>
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
        <p className="mt-1 text-[13px] text-text-secondary">
          {userName ? `Welcome back, ${userName}.` : "Welcome back."}{" "}
          <span className="text-text-primary/80">
            Focus on execution, not impulse.
          </span>
        </p>
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

function FocusCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative mt-5 overflow-hidden rounded-2xl p-[1.5px]"
      style={{ backgroundImage: "var(--gradient-mix)" }}
    >
      <div className="relative rounded-[14px] bg-card p-4">
        <div
          className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(0,198,255,0.5), transparent 70%)",
          }}
        />
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-mix shadow-glow-primary">
            <Brain className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                Today's Focus
              </span>
              <span className="h-1 w-1 rounded-full bg-text-secondary/40" />
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-gradient-mix">
                Live
              </span>
            </div>
            <p className="mt-1 text-[14px] font-medium leading-snug text-text-primary">
              Based on your behavior, stay patient and avoid overtrading.
            </p>
          </div>
        </div>
      </div>
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
      className={`mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80 ${className}`}
    >
      <span>{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-text-secondary/20 to-transparent" />
    </div>
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
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      onClick={() => toast(`${feature.title} — opening soon`)}
      className={`group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl bg-card p-3.5 text-left ring-1 ring-border transition-all hover:shadow-card-premium ${tone.ring}`}
    >
      <div
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone.iconBg} ${tone.glow}`}
      >
        <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
        <FeatureMicroAnim featureKey={feature.key} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-text-primary">
            {feature.title}
          </h3>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-text-secondary">
          {feature.text}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-text-secondary/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-primary" />
    </motion.button>
  );
}

function FeatureMicroAnim({ featureKey }: { featureKey: string }) {
  // Tiny looping decoration on the icon tile.
  if (featureKey === "mind") {
    return (
      <motion.span
        className="absolute inset-0 rounded-xl ring-2 ring-white/40"
        animate={{ opacity: [0, 0.5, 0], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }
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
      {/* Faint grid */}
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
