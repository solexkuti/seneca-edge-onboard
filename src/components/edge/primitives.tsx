// Seneca Edge — shared component primitives.
//
// These are deliberately small, prop-driven, and reusable across the
// dashboard, onboarding, and any future surfaces. They follow the
// Dark + Orange identity:
//   - background  #0B0B0D   (page)
//   - card        #111114   (.card-premium)
//   - border      #1F1F23
//   - profit      #22C55E   solid
//   - loss        #EF4444   solid
//   - missed/warn #FACC15   solid
//   - brand       linear-gradient(135deg, #FF6A00, #FFB347) — CTAs only
//
// No data fetching here. All state (loading / empty / populated) is driven
// by props so each surface can compose them however it needs.

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ---------------- Tokens ----------------
const COLOR = {
  profit: "#22C55E",
  loss: "#EF4444",
  warn: "#FACC15",
  neutral: "#A1A1AA",
  muted: "#6B7280",
} as const;

export type Tone = "profit" | "loss" | "warn" | "neutral";
export const toneColor = (tone: Tone) => COLOR[tone];

export function toneForR(r: number, threshold = 0): Tone {
  if (r > threshold) return "profit";
  if (r < threshold) return "loss";
  return "neutral";
}

// ---------------- AppShell ----------------
type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-[#1F1F23] bg-[#0B0B0D]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0B0B0D]/70 sticky top-0 z-30">
        <div className="mx-auto max-w-[1400px] px-6 py-5 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-white truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[#A1A1AA] mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">{children}</main>
    </div>
  );
}

// ---------------- TopMetricsBar ----------------
export type Metric = {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
};

export function TopMetricsBar({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <div
          key={i}
          className="card-premium p-5 flex flex-col gap-1"
        >
          <div className="text-xs uppercase tracking-wider text-[#6B7280]">
            {m.label}
          </div>
          <div
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: m.tone ? toneColor(m.tone) : "#FFFFFF" }}
          >
            {m.value}
          </div>
          {m.hint && (
            <div className="text-xs text-[#A1A1AA] mt-1">{m.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------- InsightCard ----------------
export function InsightCard({
  title,
  detail,
  severity = "info",
  footer,
}: {
  title: string;
  detail: string;
  severity?: "info" | "warn" | "critical";
  footer?: ReactNode;
}) {
  const accent =
    severity === "critical" ? COLOR.loss : severity === "warn" ? COLOR.warn : COLOR.neutral;
  return (
    <div className="card-premium p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: accent }}
        />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm text-[#A1A1AA] leading-relaxed">{detail}</p>
      {footer && <div className="pt-1">{footer}</div>}
    </div>
  );
}

// ---------------- ViolationTag ----------------
export function ViolationTag({
  label,
  impactR,
}: {
  label: string;
  impactR?: number;
}) {
  const tone: Tone = typeof impactR === "number" && impactR < 0 ? "loss" : "warn";
  const color = toneColor(tone);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color,
        background: `${color}1A`,
        border: `1px solid ${color}33`,
      }}
    >
      {label.replace(/_/g, " ")}
      {typeof impactR === "number" && (
        <span className="opacity-80">{impactR.toFixed(2)}R</span>
      )}
    </span>
  );
}

// ---------------- TradeCard ----------------
export type TradeCardData = {
  id: string;
  asset: string;
  direction: "buy" | "sell" | null;
  rr: number | null;
  result: "win" | "loss" | "breakeven" | null;
  trade_type?: string | null;
  rules_broken?: string[];
  occurred_at: string;
};

export function TradeCard({
  trade,
  onClick,
}: {
  trade: TradeCardData;
  onClick?: () => void;
}) {
  const missed = trade.trade_type === "missed";
  const r = trade.rr ?? 0;
  const tone: Tone = missed ? "warn" : toneForR(r);
  const color = toneColor(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-premium w-full text-left p-4 hover:bg-[#151518] transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">
              {trade.asset || "—"}
            </span>
            {trade.direction && (
              <span className="text-xs text-[#6B7280] uppercase">
                {trade.direction}
              </span>
            )}
            {missed && (
              <span
                className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5"
                style={{ color: COLOR.warn, background: `${COLOR.warn}1A` }}
              >
                Missed
              </span>
            )}
          </div>
          <div className="text-xs text-[#A1A1AA] mt-1">
            {new Date(trade.occurred_at).toLocaleString()}
          </div>
        </div>
        <div
          className="text-lg font-extrabold tabular-nums"
          style={{ color }}
        >
          {missed ? `−${Math.abs(r).toFixed(2)}R` : `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`}
        </div>
      </div>
      {trade.rules_broken && trade.rules_broken.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {trade.rules_broken.slice(0, 4).map((r, i) => (
            <ViolationTag key={i} label={r} />
          ))}
          {trade.rules_broken.length > 4 && (
            <span className="text-xs text-[#6B7280]">
              +{trade.rules_broken.length - 4} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ---------------- BehaviorCard ----------------
export function BehaviorCard({
  type,
  count,
  totalImpactR,
  lastOccurredAt,
}: {
  type: string;
  count: number;
  totalImpactR: number;
  lastOccurredAt: string | null;
}) {
  const tone: Tone = totalImpactR < 0 ? "loss" : "warn";
  const color = toneColor(tone);
  return (
    <div className="card-premium p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white capitalize">
          {type.replace(/_/g, " ")}
        </div>
        <div className="text-xs text-[#A1A1AA] mt-1">
          {count}× {lastOccurredAt && `· last ${new Date(lastOccurredAt).toLocaleDateString()}`}
        </div>
      </div>
      <div
        className="text-lg font-extrabold tabular-nums whitespace-nowrap"
        style={{ color }}
      >
        {totalImpactR >= 0 ? "+" : ""}
        {totalImpactR.toFixed(2)}R
      </div>
    </div>
  );
}

// ---------------- ChartContainer ----------------
export function ChartContainer({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {right}
      </div>
      <div className="w-full">{children}</div>
    </section>
  );
}

// ---------------- TimelineList ----------------
export type TimelineItem = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone?: Tone;
};

export function TimelineList({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Timeline is empty"
        description="Log a trade or a missed setup to see your behavior chronologically."
      />
    );
  }
  return (
    <ol className="relative space-y-3 pl-5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-[#1F1F23]">
      {items.map((item) => {
        const color = item.tone ? toneColor(item.tone) : COLOR.neutral;
        return (
          <li key={item.id} className="relative">
            <span
              className="absolute -left-[14px] top-1.5 h-3 w-3 rounded-full ring-4 ring-[#0B0B0D]"
              style={{ background: color }}
            />
            <div className="text-xs text-[#6B7280]">
              {new Date(item.at).toLocaleString()}
            </div>
            <div className="text-sm font-medium text-white">{item.title}</div>
            {item.detail && (
              <div className="text-xs text-[#A1A1AA] mt-0.5">{item.detail}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------- ActionPanel ----------------
export function ActionPanel({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions: ReactNode;
}) {
  return (
    <div className="card-premium p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {description && (
          <p className="text-sm text-[#A1A1AA] mt-1">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

// ---------------- EmptyState ----------------
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-premium p-10 text-center flex flex-col items-center gap-3">
      <div className="text-base font-semibold text-white">{title}</div>
      {description && (
        <p className="text-sm text-[#A1A1AA] max-w-md">{description}</p>
      )}
      {action}
    </div>
  );
}

// ---------------- LoadingSkeleton ----------------
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "card-premium p-5 animate-pulse",
            "h-20 bg-[#111114]",
          )}
        />
      ))}
    </div>
  );
}

// ---------------- Modal ----------------
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card-premium w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A1A1AA] hover:text-white transition-colors text-sm"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
