// /hub/connections — Connection Center.
//
// Manual journal (free) · MT5 manual upload (Pro) · Deriv (coming soon).
// Premium upgrade path lives at /hub/connections/automate. Behavioral
// nudges based on upload history fire via SyncStatusBanner.

import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  CircleDot,
  Plug,
  ShieldCheck,
  Sparkles,
  Crown,
} from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";
import { SyncStatusBanner } from "@/components/feature/SyncStatusBanner";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";

export const Route = createFileRoute("/hub/connections")({
  head: () => ({
    meta: [
      { title: "Connections — SenecaEdge" },
      {
        name: "description",
        content:
          "Connect your broker so Seneca measures every trade you actually take.",
      },
    ],
  }),
  component: ConnectionsPage,
});

const ease = [0.22, 1, 0.36, 1] as const;

type Provider = {
  id: "deriv" | "mt5" | "manual";
  name: string;
  tagline: string;
  description: string;
  status: "soon" | "active" | "pro";
  bullets: string[];
  href?: string;
  upsell?: { label: string; href: string };
};

const PROVIDERS: Provider[] = [
  {
    id: "manual",
    name: "Manual journal",
    tagline: "Always available",
    description:
      "Log executed and missed trades by hand. The default — trains the eye and forces honesty.",
    status: "active",
    bullets: [
      "Executed and missed trades",
      "Screenshots and notes",
      "Behavior tagging",
    ],
  },
  {
    id: "mt5",
    name: "MT5 — manual upload",
    tagline: "Pro · CSV import",
    description:
      "Drop your MT5 history CSV. Seneca maps every closed deal — duplicates skipped automatically.",
    status: "pro",
    bullets: [
      "Any MT5 broker",
      "Bulk upload, ticket-level dedup",
      "Temporary — until you automate",
    ],
    href: "/hub/connections/mt5",
    upsell: { label: "Automate this →", href: "/hub/connections/automate" },
  },
  {
    id: "deriv",
    name: "Deriv",
    tagline: "Pro · WebSocket sync",
    description:
      "Stream closed contracts in real time. Premium adds auto-sync every 15 minutes — no exports, no buttons.",
    status: "pro",
    bullets: [
      "Boom / Crash / Volatility indices",
      "Auto-pulled trade results",
      "Premium: hands-off every 15 min",
    ],
    href: "/hub/connections/deriv",
    upsell: { label: "See automation tiers →", href: "/hub/connections/automate" },
  },
];

function ConnectionsPage() {
  return (
    <HubPageContainer
      eyebrow="Sources"
      title="Connection Center"
      subtitle="Connect a broker so Seneca measures every trade you actually take — not just the ones you remember."
      wide
    >
      <div className="mb-5">
        <SyncStatusBanner />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PROVIDERS.map((p, i) => (
          <ProviderCard key={p.id} provider={p} delay={i * 0.05} />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-[#C6A15B]/15 bg-[#18181A] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#C6A15B] mt-0.5" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#C6A15B]">
              Read-only by design
            </p>
            <p className="mt-1.5 text-[13px] text-[#EDEDED]/85 leading-relaxed">
              Broker integrations are read-only. Seneca pulls trade history to
              measure behavior — it never places, modifies, or closes orders.
              Your account credentials never touch our servers.
            </p>
          </div>
        </div>
      </div>
    </HubPageContainer>
  );
}

function ProviderCard({
  provider,
  delay,
}: {
  provider: Provider;
  delay: number;
}) {
  const { isPro } = useSubscriptionTier();
  const isActive = provider.status === "active";
  const isProTier = provider.status === "pro";

  const ctaLabel = isActive
    ? "Already in use"
    : isProTier
      ? isPro
        ? "Open uploader"
        : "Unlock with Pro"
      : "Notify me when ready";

  const ctaHref = isProTier
    ? isPro
      ? provider.href ?? "/hub/connections/mt5"
      : "/hub/billing"
    : null;

  const pill = isActive
    ? { tone: "active" as const, label: "Active" }
    : isProTier
      ? { tone: "pro" as const, label: "Pro" }
      : { tone: "soon" as const, label: "Coming soon" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay }}
      className={`rounded-2xl border p-5 ${
        isActive || isProTier
          ? "border-[#C6A15B]/30 bg-[#18181A]"
          : "border-white/[0.06] bg-[#18181A]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          {provider.id === "manual" ? (
            <Sparkles className="h-[18px] w-[18px] text-[#C6A15B]" />
          ) : provider.id === "deriv" ? (
            <Activity className="h-[18px] w-[18px] text-[#C6A15B]" />
          ) : (
            <Plug className="h-[18px] w-[18px] text-[#C6A15B]" />
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${
            pill.tone === "active"
              ? "bg-emerald-500/10 ring-emerald-500/25 text-emerald-300"
              : pill.tone === "pro"
                ? "bg-[#C6A15B]/15 ring-[#C6A15B]/30 text-[#E7C98A]"
                : "bg-[#C6A15B]/10 ring-[#C6A15B]/25 text-[#E7C98A]"
          }`}
        >
          {pill.tone === "pro" ? (
            <Crown className="h-2.5 w-2.5" />
          ) : (
            <CircleDot className="h-2.5 w-2.5" />
          )}
          {pill.label}
        </span>
      </div>

      <h3 className="mt-4 font-serif text-[20px] tracking-tight text-[#EDEDED]">
        {provider.name}
      </h3>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[#9A9A9A]/80">
        {provider.tagline}
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[#9A9A9A]">
        {provider.description}
      </p>

      <ul className="mt-4 space-y-1.5">
        {provider.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-[11.5px] text-[#EDEDED]/80"
          >
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#C6A15B]" />
            {b}
          </li>
        ))}
      </ul>

      {ctaHref ? (
        <Link
          to={ctaHref}
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[#C6A15B] px-4 py-2.5 text-[12.5px] font-medium text-[#0B0B0D] transition-colors hover:bg-[#E7C98A]"
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className={`mt-5 w-full rounded-lg px-4 py-2.5 text-[12.5px] font-medium transition-colors ${
            isActive
              ? "bg-white/[0.04] text-[#9A9A9A] cursor-default"
              : "bg-white/[0.03] text-[#9A9A9A] cursor-not-allowed"
          }`}
        >
          {ctaLabel}
        </button>
      )}

      {provider.upsell && (
        <Link
          to={provider.upsell.href}
          className="mt-2 block text-center text-[11px] font-medium text-[#C6A15B]/85 hover:text-[#E7C98A]"
        >
          {provider.upsell.label}
        </Link>
      )}
    </motion.div>
  );
}
