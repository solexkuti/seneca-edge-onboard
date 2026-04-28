// /hub/daily — generate today's adaptive checklist PDF.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Download, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import RequireAuth from "@/components/auth/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/daily")({
  head: () => ({
    meta: [
      { title: "Daily Checklist — SenecaEdge" },
      {
        name: "description",
        content:
          "Adaptive daily execution checklist. Tightens when discipline drops, relaxes when it strengthens.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <DailyChecklistPage />
    </RequireAuth>
  ),
});

type GenResult = {
  control_state: "in_control" | "at_risk" | "out_of_control";
  discipline_score: number;
  allowed_tiers: string[];
  applied_restrictions: string[];
  suggest_no_trade_day: boolean;
  pdf_base64: string;
  filename: string;
};

function StateBadge({ state }: { state: GenResult["control_state"] }) {
  const cfg =
    state === "in_control"
      ? {
          Icon: ShieldCheck,
          label: "IN CONTROL",
          cls: "bg-emerald-600/10 text-emerald-700 ring-emerald-600/20",
        }
      : state === "at_risk"
        ? {
            Icon: Shield,
            label: "AT RISK",
            cls: "bg-amber-600/10 text-amber-700 ring-amber-600/20",
          }
        : {
            Icon: ShieldAlert,
            label: "OUT OF CONTROL",
            cls: "bg-red-600/10 text-red-700 ring-red-600/20",
          };
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${cfg.cls}`}
    >
      <Icon className="h-3.5 w-3.5" /> {cfg.label}
    </span>
  );
}

function DailyChecklistPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sign in required.");
        return;
      }
      const { data, error } = await supabase.functions.invoke(
        "generate-daily-checklist",
        {
          headers: { Accept: "application/json" },
        },
      );
      if (error) throw error;
      const r = data as GenResult;
      setResult(r);
      toast.success("Daily checklist ready.");
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "Could not generate checklist.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!result) return;
    const bin = atob(result.pdf_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10 mx-auto w-full max-w-[640px] px-5 pt-6 pb-24">
        <div className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-card px-3 text-sm ring-1 ring-border shadow-soft hover:shadow-card-premium"
          >
            ← Hub
          </Link>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Daily Execution
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Today's Checklist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Adapts to your last 20 trades, behavior patterns, and current control
            state. Tightens when you slip — relaxes when you stay disciplined.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft"
        >
          {!result ? (
            <>
              <p className="text-sm text-foreground">
                Generate your personalized daily PDF.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Uses your active strategy, recent discipline score, and detected
                patterns. AI is used only for short focus wording — never for
                rules.
              </p>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>Generate today's checklist</>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <StateBadge state={result.control_state} />
                <span className="text-xs text-muted-foreground">
                  Discipline {result.discipline_score} / 100
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Allowed setups
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {result.allowed_tiers.join(" · ")}
                  </div>
                </div>
                <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Active restrictions
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {result.applied_restrictions.length}
                  </div>
                </div>
              </div>

              {result.suggest_no_trade_day && (
                <div className="mt-3 rounded-xl bg-red-600/5 p-3 text-xs text-red-700 ring-1 ring-red-600/15">
                  Recent behavior suggests this should be a no-trade day.
                </div>
              )}

              {result.applied_restrictions.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Today's adjustments
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                    {result.applied_restrictions.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-border hover:bg-background disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Regenerating…
                    </>
                  ) : (
                    <>Regenerate</>
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
