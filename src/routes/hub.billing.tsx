// /hub/billing — Subscription & billing scaffold.
//
// Phase 5 ships the UI surface. Real Paystack/Flutterwave checkout lands
// in a later phase once the user has a live merchant account. The plan
// shape here matches what the eventual checkout edge function will expect.

import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles } from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";

export const Route = createFileRoute("/hub/billing")({
  head: () => ({
    meta: [
      { title: "Subscription — SenecaEdge" },
      {
        name: "description",
        content: "Plans and billing for Seneca Edge.",
      },
    ],
  }),
  component: BillingPage,
});

const ease = [0.22, 1, 0.36, 1] as const;

type Plan = {
  id: "free" | "pro" | "elite";
  name: string;
  price: { ngn: string; usd: string };
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
  current?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Foundation",
    price: { ngn: "₦0", usd: "$0" },
    tagline: "Train the eye. Build the habit.",
    features: [
      "Manual journal — executed + missed",
      "Behavior score and rule adherence",
      "Last 30 days of insights",
    ],
    cta: "Current plan",
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: { ngn: "₦9,900 / mo", usd: "$9.99 / mo" },
    tagline: "The intelligence engine, unlocked.",
    features: [
      "Everything in Foundation",
      "Unlimited insights and history",
      "AI Mentor — unlimited",
      "Chart Analyzer with rule-grading",
      "Asset behavior + session analysis",
    ],
    cta: "Upgrade to Pro",
    featured: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: { ngn: "₦24,900 / mo", usd: "$24.99 / mo" },
    tagline: "For traders running systems.",
    features: [
      "Everything in Pro",
      "Live broker sync (Deriv, MT5)",
      "Strategy backtest replay",
      "Priority mentor model",
      "Export everything",
    ],
    cta: "Talk to us",
  },
];

function BillingPage() {
  return (
    <HubPageContainer
      eyebrow="Subscription"
      title="Plans"
      subtitle="Pay once a month. Cancel anytime. Built for African traders — Naira and USD supported."
      wide
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((p, i) => (
          <PlanCard key={p.id} plan={p} delay={i * 0.05} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard
          eyebrow="Payment"
          title="Pay in your currency"
          body="Naira via Paystack. USD via card or international rails. No hidden FX markup."
        />
        <InfoCard
          eyebrow="Cancellation"
          title="No lock-in"
          body="Cancel anytime from this page. Your trade history and behavior data stay yours — exportable on demand."
        />
      </div>
    </HubPageContainer>
  );
}

function PlanCard({ plan, delay }: { plan: Plan; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay }}
      className={`relative rounded-2xl border p-5 ${
        plan.featured
          ? "border-[#C6A15B]/40 bg-[#18181A] shadow-[0_0_40px_-20px_rgba(198,161,91,0.45)]"
          : "border-white/[0.06] bg-[#18181A]"
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-2.5 right-5 inline-flex items-center gap-1 rounded-full bg-[#C6A15B] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0B0B0D]">
          <Crown className="h-3 w-3" />
          Most chosen
        </span>
      )}

      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#C6A15B]" />
        <h3 className="font-serif text-[22px] tracking-tight text-[#EDEDED]">
          {plan.name}
        </h3>
      </div>
      <p className="mt-1 text-[12px] text-[#9A9A9A]">{plan.tagline}</p>

      <div className="mt-4">
        <p className="font-serif text-[24px] tabular-nums text-[#EDEDED]">
          {plan.price.ngn}
        </p>
        <p className="text-[11.5px] text-[#9A9A9A]/80">or {plan.price.usd}</p>
      </div>

      <ul className="mt-5 space-y-2">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-[12.5px] text-[#EDEDED]/85"
          >
            <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#C6A15B]" />
            {f}
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={plan.current}
        className={`mt-6 w-full rounded-lg px-4 py-2.5 text-[12.5px] font-medium transition-colors ${
          plan.current
            ? "bg-white/[0.04] text-[#9A9A9A] cursor-default"
            : plan.featured
              ? "bg-[#C6A15B] text-[#0B0B0D] hover:bg-[#E7C98A]"
              : "bg-white/[0.05] text-[#EDEDED] hover:bg-white/[0.08]"
        }`}
      >
        {plan.cta}
      </button>
    </motion.div>
  );
}

function InfoCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#18181A] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#C6A15B]/80">
        {eyebrow}
      </p>
      <h4 className="mt-1.5 font-serif text-[18px] text-[#EDEDED]">{title}</h4>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#9A9A9A]">{body}</p>
    </div>
  );
}
