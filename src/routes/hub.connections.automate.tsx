// /hub/connections/automate — Premium upgrade screen for automatic MT5 sync.
//
// Two paths, both Premium:
//   1. MetaApi (easy)   — paste login/server/password, sync runs in our cloud.
//   2. EA webhook (advanced) — drop our Expert Advisor in MT5, it POSTs deals
//      back to a public webhook. Free of vendor cost but installs a .ex5.
//
// We don't actually wire either provider here — that's a follow-up. This
// page is the conversion surface: clear comparison, strong CTA, honest
// trade-offs.

import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Cloud,
  Cpu,
  Crown,
  ShieldCheck,
  Zap,
  Clock,
  Wrench,
} from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";

export const Route = createFileRoute("/hub/connections/automate")({
  head: () => ({
    meta: [
      { title: "Automate MT5 Sync — SenecaEdge" },
      {
        name: "description",
        content:
          "Two ways to put MT5 sync on autopilot: cloud bridge or local Expert Advisor. Stop uploading. Premium plan.",
      },
    ],
  }),
  component: AutomatePage,
});

const ease = [0.22, 1, 0.36, 1] as const;

function AutomatePage() {
  return (
    <HubPageContainer
      eyebrow="Premium · automation"
      title="Stop uploading. Start syncing."
      subtitle="Premium connects Seneca directly to your MT5 account. Pick the path that fits how you trade."
      wide
    >
      <div className="mb-5">
        <Link
          to="/hub/connections"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9A9A9A] hover:text-[#EDEDED]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Connections
        </Link>
      </div>

      {/* Why automation — the emotional sell */}
      <WhyAutomate />

      {/* Two paths */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OptionCard
          recommended
          delay={0}
          icon={<Cloud className="h-5 w-5 text-[#E7C98A]" />}
          eyebrow="Easy · 2-minute setup"
          name="MetaApi cloud bridge"
          tagline="Paste your MT5 login. We do the rest."
          description="Seneca's cloud connects to your broker via MetaApi — a hardened bridge trusted by prop firms and serious traders. Closed deals stream into your journal in real-time, even when your computer is off."
          bullets={[
            { icon: Zap, text: "Real-time sync — sub-second latency" },
            { icon: Cloud, text: "Runs in the cloud, no install" },
            { icon: ShieldCheck, text: "Read-only credentials, encrypted at rest" },
            { icon: Clock, text: "Works 24/7, weekends included" },
          ]}
          tradeoff="Adds a small monthly cost on top of Premium for the cloud bridge. Best for funded accounts and anyone who trades from mobile."
          cta="Start with MetaApi"
        />
        <OptionCard
          delay={0.06}
          icon={<Cpu className="h-5 w-5 text-[#E7C98A]" />}
          eyebrow="Advanced · self-hosted"
          name="EA webhook"
          tagline="Local Expert Advisor pushes deals to Seneca."
          description="Drop our signed Expert Advisor (.ex5) into MT5. When a position closes, the EA POSTs the deal to your private Seneca webhook. No third-party cloud, no recurring vendor fee."
          bullets={[
            { icon: Wrench, text: "One-time install — copy .ex5 into MT5" },
            { icon: ShieldCheck, text: "Credentials never leave your machine" },
            { icon: Cpu, text: "Works offline — queues deals, syncs when online" },
            { icon: Zap, text: "Real-time when MT5 is open" },
          ]}
          tradeoff="MT5 must be running for sync to fire. Requires desktop access. Best for traders who keep a dedicated VPS or always-on workstation."
          cta="Get the EA"
        />
      </div>

      {/* Comparison strip */}
      <ComparisonTable />

      {/* Closing CTA */}
      <div className="mt-8 rounded-2xl border border-[#C6A15B]/30 bg-gradient-to-br from-[#1A1612] to-[#18181A] p-6 sm:p-8 text-center">
        <Crown className="mx-auto h-6 w-6 text-[#E7C98A]" />
        <h3 className="mt-3 font-serif text-[22px] tracking-tight text-[#EDEDED]">
          Premium pays for itself the first week
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-[#9A9A9A]">
          Every trade you forget to log is a blind spot in your behavior score.
          Automation closes the gap — quietly, in the background, forever.
        </p>
        <Link
          to="/hub/billing"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#C6A15B] px-5 py-3 text-[13px] font-semibold text-[#0B0B0D] shadow-[0_0_25px_rgba(198,161,91,0.3)] transition-colors hover:bg-[#E7C98A]"
        >
          Upgrade to Premium
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </HubPageContainer>
  );
}

// ───────── sections ─────────

function WhyAutomate() {
  const items = [
    {
      icon: Zap,
      title: "Every closed deal, captured",
      body: "Including the ones you'd rather forget. Behavior data is only honest when it's complete.",
    },
    {
      icon: Clock,
      title: "Zero weekly admin",
      body: "Manual upload averages 4 minutes per export. Premium gives that back.",
    },
    {
      icon: ShieldCheck,
      title: "Read-only by design",
      body: "Seneca pulls trade history. It can't place, modify, or close orders. Your account is untouched.",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease, delay: i * 0.04 }}
            className="rounded-2xl border border-white/[0.06] bg-[#18181A] p-4"
          >
            <Icon className="h-4 w-4 text-[#C6A15B]" />
            <p className="mt-3 font-serif text-[15px] text-[#EDEDED]">
              {it.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#9A9A9A]">
              {it.body}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

interface OptionCardProps {
  recommended?: boolean;
  delay: number;
  icon: React.ReactNode;
  eyebrow: string;
  name: string;
  tagline: string;
  description: string;
  bullets: { icon: typeof Zap; text: string }[];
  tradeoff: string;
  cta: string;
}

function OptionCard({
  recommended,
  delay,
  icon,
  eyebrow,
  name,
  tagline,
  description,
  bullets,
  tradeoff,
  cta,
}: OptionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay }}
      className={`relative rounded-2xl border p-5 sm:p-6 ${
        recommended
          ? "border-[#C6A15B]/40 bg-[#18181A] shadow-[0_0_40px_-20px_rgba(198,161,91,0.45)]"
          : "border-white/[0.06] bg-[#18181A]"
      }`}
    >
      {recommended && (
        <span className="absolute -top-2.5 right-5 inline-flex items-center gap-1 rounded-full bg-[#C6A15B] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0B0B0D]">
          <Crown className="h-3 w-3" />
          Recommended
        </span>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C6A15B]/10 ring-1 ring-[#C6A15B]/25">
          {icon}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#C6A15B]/80">
            {eyebrow}
          </p>
          <h3 className="font-serif text-[20px] tracking-tight text-[#EDEDED]">
            {name}
          </h3>
        </div>
      </div>

      <p className="mt-3 text-[13px] text-[#EDEDED]/85">{tagline}</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#9A9A9A]">
        {description}
      </p>

      <ul className="mt-4 space-y-2">
        {bullets.map((b, i) => {
          const Icon = b.icon;
          return (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[12.5px] text-[#EDEDED]/85"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C6A15B]" />
              {b.text}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-lg bg-[#0F0F11] ring-1 ring-white/5 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/70">
          Trade-off
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#9A9A9A]">
          {tradeoff}
        </p>
      </div>

      <Link
        to="/hub/billing"
        className={`mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[12.5px] font-medium transition-colors ${
          recommended
            ? "bg-[#C6A15B] text-[#0B0B0D] hover:bg-[#E7C98A]"
            : "bg-white/[0.05] text-[#EDEDED] hover:bg-white/[0.08]"
        }`}
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  );
}

function ComparisonTable() {
  const rows: { feature: string; metaapi: string; ea: string }[] = [
    { feature: "Setup time", metaapi: "~2 min", ea: "~10 min" },
    { feature: "Real-time sync", metaapi: "Yes (24/7)", ea: "When MT5 runs" },
    { feature: "Works offline", metaapi: "—", ea: "Queues then syncs" },
    { feature: "Vendor fee", metaapi: "Small monthly", ea: "None" },
    { feature: "Best for", metaapi: "Mobile / funded", ea: "VPS / desktop" },
  ];
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#18181A]">
      <div className="border-b border-white/5 px-5 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/70">
          At a glance
        </p>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/5">
            <th className="px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]/70">
              Feature
            </th>
            <th className="px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#E7C98A]">
              MetaApi
            </th>
            <th className="px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]/70">
              EA webhook
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.feature} className="border-b border-white/[0.04] last:border-0">
              <td className="px-5 py-3 text-[12.5px] text-[#9A9A9A]">
                {r.feature}
              </td>
              <td className="px-5 py-3 text-[12.5px] text-[#EDEDED]">
                {r.metaapi}
              </td>
              <td className="px-5 py-3 text-[12.5px] text-[#EDEDED]/85">
                {r.ea}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
