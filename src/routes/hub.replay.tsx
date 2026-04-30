import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { PlayCircle, SkipForward, Pause, Play, Gauge, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";

export const Route = createFileRoute("/hub/replay")({
  head: () => ({
    meta: [{ title: "Replay & Backtest — SenecaEdge" }],
  }),
  component: ReplayPage,
});

function ReplayPage() {
  return (
    <HubPageContainer
      eyebrow="Replay · Backtest"
      title="Replay the market"
      subtitle="Step through historical price action, simulate trades, and pressure-test your edge before the next session."
      wide
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Chart area */}
        <div className="space-y-6">
          <ChartFrame />
          <ReplayControls />
        </div>

        {/* Side panel */}
        <aside className="space-y-6">
          <SimulatorCard />
          <SessionStats />
        </aside>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Trades simulated" value="—" hint="No session yet" />
        <SummaryCard label="Win rate" value="—" hint="Run a replay to score" />
        <SummaryCard label="Avg R" value="—" hint="Awaiting trades" />
      </div>
    </HubPageContainer>
  );
}

function ChartFrame() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#16181D]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gold" />
          <span className="text-[12px] font-semibold tracking-tight text-text-primary">
            EUR/USD · 15m
          </span>
        </div>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/70">
          Chart workspace
        </span>
      </div>
      <div className="relative aspect-[16/9] w-full">
        {/* Placeholder grid suggesting a chart canvas */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <PlayCircle className="h-10 w-10 text-gold/70" strokeWidth={1.5} />
          <p className="mt-3 font-display text-[18px] tracking-tight text-text-primary">
            Replay engine coming soon
          </p>
          <p className="mt-1.5 max-w-sm text-[12.5px] text-text-secondary">
            This space is reserved for an embedded chart and historical replay. Logic is intact — only the surface is being reshaped.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ReplayControls() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#16181D] px-4 py-3">
      <ControlButton Icon={Play} label="Play" />
      <ControlButton Icon={Pause} label="Pause" />
      <ControlButton Icon={SkipForward} label="Step" />
      <div className="ml-auto flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-1.5">
        <Gauge className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.9} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary/80">
          Speed
        </span>
        {["0.5x", "1x", "2x", "4x"].map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${
              s === "1x"
                ? "bg-white/[0.08] text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ControlButton({
  Icon,
  label,
}: {
  Icon: typeof Play;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] font-medium text-text-primary transition-colors hover:border-white/10 hover:bg-white/[0.05]"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </button>
  );
}

function SimulatorCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">
        Trade simulator
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
        Place hypothetical orders against the replay tape. UI only — no live execution.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-emerald-500/10 px-3 py-2.5 text-[13px] font-semibold text-text-primary transition-colors hover:bg-emerald-500/15">
          <ArrowUpRight className="h-4 w-4 text-gold" strokeWidth={2.2} /> Buy
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-rose-500/10 px-3 py-2.5 text-[13px] font-semibold text-text-primary transition-colors hover:bg-rose-500/15">
          <ArrowDownRight className="h-4 w-4 text-rose-300" strokeWidth={2.2} /> Sell
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Stop loss" placeholder="e.g. 1.0820" />
        <Field label="Take profit" placeholder="e.g. 1.0890" />
        <Field label="Risk %" placeholder="1.0" />
      </div>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </span>
      <input
        type="text"
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[13px] text-text-primary placeholder:text-text-secondary/50 focus:border-gold/40 focus:outline-none"
      />
    </label>
  );
}

function SessionStats() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">
        Session
      </p>
      <dl className="mt-3 space-y-3 text-[13px]">
        {[
          ["Equity", "$10,000.00"],
          ["Open trades", "0"],
          ["Realized P&L", "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-text-secondary">{k}</dt>
            <dd className="font-medium text-text-primary">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
        {label}
      </p>
      <p className="mt-2 font-display text-[26px] font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      <p className="mt-1 text-[12px] text-text-secondary">{hint}</p>
    </div>
  );
}
