// SenecaDashboard — behavioral intelligence hub.
// Reads from the new journal_entries / profiles.discipline_score system.

import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpenCheck,
  History,
  LineChart,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { useBehavioralJournal } from "@/hooks/useBehavioralJournal";
import { useTraderState } from "@/hooks/useTraderState";
import {
  disciplineState,
  lastMistakeOf,
  nextActionFromBehavior,
} from "@/lib/behavioralJournal";

const ease = [0.22, 1, 0.36, 1] as const;

const TONE_TEXT: Record<string, string> = {
  ok: "text-emerald-300",
  drift: "text-amber-300",
  warn: "text-orange-300",
  risk: "text-rose-300",
};
const TONE_DOT: Record<string, string> = {
  ok: "bg-emerald-400",
  drift: "bg-amber-400",
  warn: "bg-orange-400",
  risk: "bg-rose-400",
};
const TONE_BAR: Record<string, string> = {
  ok: "bg-emerald-400/70",
  drift: "bg-amber-400/70",
  warn: "bg-orange-400/70",
  risk: "bg-rose-400/70",
};

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortLine(input: string | null | undefined, max = 64): string | null {
  if (!input) return null;
  const s = input.replace(/[\r\n]+/g, " ").trim();
  if (!s) return null;
  const first = s.split(/(?<=[.;:])\s|\s—\s/)[0] ?? s;
  return first.length > max ? first.slice(0, max - 1) + "…" : first;
}

export default function SenecaDashboard({ userName }: { userName?: string }) {
  const { entries, score, loading } = useBehavioralJournal(20);
  const { state } = useTraderState();

  const ds = disciplineState(score);
  const last = entries[0];
  const cleanStreak = last?.clean_streak_after ?? 0;
  const breakStreak = last?.break_streak_after ?? 0;
  const lastMistake = useMemo(() => lastMistakeOf(entries), [entries]);
  const action = useMemo(
    () => nextActionFromBehavior({ entries, score }),
    [entries, score],
  );

  const initial = userName ? userName.slice(0, 1).toUpperCase() : "S";
  const bp = state.strategy?.blueprint ?? null;
  const hasStrategy = !!bp;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-60" />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-8 pb-24">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-text-secondary/55">
              Seneca Edge
            </p>
            <h1 className="mt-2 text-[22px] font-semibold leading-[1.15] tracking-tight text-text-primary">
              {userName ? `Welcome back, ${userName}.` : "Welcome back."}
            </h1>
          </div>
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
            <span className="text-[12.5px] font-semibold text-text-primary">{initial}</span>
          </div>
        </header>

        {/* PRIMARY · Control State */}
        <Section delay={0.05} className="mt-8">
          <div className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-accent-primary">
            <div
              aria-hidden
              className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
                ds.tone === "ok" ? "via-emerald-400/50" : ds.tone === "drift" ? "via-amber-400/50" : ds.tone === "warn" ? "via-orange-400/50" : "via-rose-400/50"
              } to-transparent`}
            />
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-text-secondary/60">
                  Control state
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-background/60 px-2.5 py-1 ring-1 ring-border">
                  <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[ds.tone]}`} />
                  <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${TONE_TEXT[ds.tone]}`}>
                    {ds.label}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-end gap-3">
                <span className={`text-[56px] font-semibold leading-none tracking-tight tabular-nums ${TONE_TEXT[ds.tone]}`}>
                  {loading ? "—" : score}
                </span>
                <span className="mb-2 text-[14px] font-medium text-text-secondary/70 tabular-nums">/100</span>
                <span className="mb-2 ml-auto text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
                  Discipline
                </span>
              </div>

              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-text-primary/[0.05]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.7, ease }}
                  className={`h-full rounded-full ${TONE_BAR[ds.tone]}`}
                />
              </div>

              <p className="mt-5 text-[13.5px] leading-snug text-text-primary/85">
                {entries.length === 0
                  ? "Log your first trade to see your real-time state."
                  : last?.classification === "severe"
                    ? "Last trade was a severe violation. Pause and reset before the next entry."
                    : breakStreak >= 2
                      ? `${breakStreak} non-clean trades in a row. Slow the next decision.`
                      : cleanStreak >= 3
                        ? `${cleanStreak} clean trades in a row. The system is holding.`
                        : `Last trade: ${last?.classification}. Keep grading every entry.`}
              </p>
            </div>
          </div>
        </Section>

        {/* PRIMARY · Next Action */}
        <Section delay={0.08} className="mt-4">
          <div className="rounded-2xl bg-card/70 p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[action.tone]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                  Next action
                </p>
                <p className="mt-1 text-[14.5px] font-semibold leading-snug tracking-tight text-text-primary">
                  {action.title}
                </p>
                <p className="mt-1 text-[12.5px] leading-snug text-text-secondary/85">{action.sub}</p>
              </div>
              <Link
                to={entries.length === 0 ? "/hub/journal" : "/hub/chart"}
                preload="intent"
                className="shrink-0 inline-flex items-center gap-1.5 self-center rounded-full bg-primary/15 px-3 py-1.5 text-[11.5px] font-semibold text-text-primary ring-1 ring-primary/25 active:scale-[0.97] transition-transform"
              >
                Go <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
              </Link>
            </div>
          </div>
        </Section>

        {/* SECONDARY · Behavior Summary */}
        <Section delay={0.14} label="Behavior" className="mt-10">
          <div className="rounded-2xl bg-card p-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/60">
                  Clean streak
                </p>
                <p className="mt-1.5 text-[20px] font-semibold tabular-nums leading-none text-emerald-300">
                  {cleanStreak}
                </p>
              </div>
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/60">
                  Break streak
                </p>
                <p className="mt-1.5 text-[20px] font-semibold tabular-nums leading-none text-rose-300">
                  {breakStreak}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/60">
                  Last mistake
                </p>
                {lastMistake ? (
                  <>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium text-text-primary">
                      {lastMistake.label}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-text-secondary/65">
                      {relTime(lastMistake.whenMs)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[12px] text-text-secondary/70">
                    {entries.length === 0 ? "—" : "None recently"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* REFERENCE · Your System */}
        <Section delay={0.2} label="Your system" className="mt-10">
          {!hasStrategy ? (
            <div className="rounded-2xl bg-card p-5 ring-1 ring-accent-primary">
              <p className="text-[13px] leading-snug text-text-secondary">
                You haven't defined your system yet. Build it once — every other tool will run against it.
              </p>
              <Link
                to="/hub/strategy"
                preload="intent"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3.5 py-2 text-[12px] font-semibold text-text-primary ring-1 ring-primary/30 active:scale-[0.98] transition-transform"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Define system
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-card p-5 ring-1 ring-accent-primary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                    {bp?.locked ? "Locked system" : "Active system"}
                  </p>
                  <p className="mt-1 truncate text-[14px] font-semibold tracking-tight text-text-primary">
                    {bp?.name || "Untitled strategy"}
                  </p>
                </div>
                <Link
                  to="/hub/strategy"
                  preload="intent"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background/60 px-3 py-1.5 text-[11px] font-semibold text-text-primary ring-1 ring-border hover:bg-text-primary/[0.04] transition-colors"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2.4} />
                  Edit
                </Link>
              </div>
              {(() => {
                const fields = [
                  { label: "Entry", value: shortLine(bp?.structured_rules?.entry?.[0] ?? bp?.raw_input ?? null) },
                  { label: "Risk", value: shortLine(bp?.structured_rules?.risk?.[0] ?? null) },
                ].filter((f) => f.value);
                if (fields.length === 0) return null;
                return (
                  <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
                    {fields.map((f) => (
                      <div key={f.label} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary/55">
                          {f.label}
                        </p>
                        <p className="mt-1.5 truncate text-[13px] font-medium text-text-primary" title={f.value ?? undefined}>
                          {f.value}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </Section>

        {/* UTILITIES */}
        <Section delay={0.26} label="Tools" className="mt-10">
          <div className="grid grid-cols-2 gap-2">
            <Tool to="/hub/journal" label="Log trade" Icon={BookOpenCheck} />
            <Tool to="/hub/journal/history" label="History" Icon={History} />
            <Tool to="/hub/chart" label="Analyze" Icon={LineChart} />
            <Tool to="/hub/mentor" label="Mentor" Icon={MessageCircle} />
          </div>
        </Section>

        <p className="mt-14 text-center text-[10.5px] font-medium uppercase tracking-[0.24em] text-text-secondary/45">
          Seneca Edge · Trading Intelligence
        </p>
      </div>
    </div>
  );
}

function Section({
  delay, label, children, className,
}: { delay: number; label?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease, delay }}
      className={className}
    >
      {label && (
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-secondary/60">
          {label}
        </p>
      )}
      {children}
    </motion.section>
  );
}

function Tool({
  to, label, Icon,
}: {
  to: "/hub/journal" | "/hub/journal/history" | "/hub/chart" | "/hub/mentor";
  label: string;
  Icon: typeof Sparkles;
}) {
  return (
    <Link
      to={to}
      preload="intent"
      className="group flex items-center justify-between rounded-xl bg-card p-3.5 active:scale-[0.97] hover:bg-text-primary/[0.03] transition-all"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-text-secondary group-hover:text-primary" strokeWidth={2.2} />
        <span className="text-[12px] font-semibold text-text-primary">{label}</span>
      </div>
      <ArrowUpRight className="h-3 w-3 text-text-secondary/70 group-hover:text-text-primary" />
    </Link>
  );
}
