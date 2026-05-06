import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, User, Bell, Palette, Database, ChevronRight, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { HubPageContainer } from "@/components/layout/HubLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import { signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_CURRENCIES, type CurrencyCode, type MetricDisplayMode } from "@/lib/ssot";
import { useSsot } from "@/hooks/useSsot";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";

const METRIC_MODES: { value: MetricDisplayMode; label: string; hint: string }[] = [
  { value: "rr_only", label: "R only", hint: "Pure trader truth — no currency noise." },
  { value: "rr_plus_currency", label: "R + currency", hint: "Show R with monetary equivalent." },
  { value: "currency_only", label: "Currency only", hint: "Hide R, show money." },
];

export const Route = createFileRoute("/hub/settings")({
  head: () => ({
    meta: [{ title: "Settings — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
});

function SettingsPage() {
  return (
    <HubPageContainer
      eyebrow="Account"
      title="Settings"
      subtitle="Manage your account balance, currency, and workspace preferences."
    >
      <AccountSettingsCard />

      <div className="mt-8 space-y-3">
        <Row Icon={User} title="Profile" subtitle="Display name, avatar" />
        <Row Icon={Bell} title="Notifications" subtitle="Trade alerts, mentor pings" />
        <Row Icon={Palette} title="Appearance" subtitle="Theme, density" />
        <Row Icon={Database} title="Data" subtitle="Export journal, clear cache" />
      </div>

      <div className="mt-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
          Session
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-[#16181D] px-5 py-4 text-left transition-colors hover:border-rose-300/20 hover:bg-rose-500/[0.04]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <LogOut className="h-[17px] w-[17px] text-rose-300" strokeWidth={1.9} />
            </div>
            <div>
              <p className="text-[14px] font-semibold tracking-tight text-text-primary">
                Sign out
              </p>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                Ends this browser session.
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-text-secondary" strokeWidth={1.9} />
        </button>
      </div>
    </HubPageContainer>
  );
}

function AccountSettingsCard() {
  const { ssot } = useSsot();
  const [balance, setBalance] = useState<string>("");
  const [risk, setRisk] = useState<string>("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>("USD");
  const [metricMode, setMetricMode] = useState<MetricDisplayMode>("rr_plus_currency");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ssot.loading) return;
    setBalance(ssot.account.balance != null ? String(ssot.account.balance) : "");
    setRisk(ssot.account.risk_per_trade != null ? String(ssot.account.risk_per_trade) : "");
    setCurrency((ssot.account.currency as CurrencyCode) ?? "USD");
    setDisplayCurrency((ssot.account.display_currency as CurrencyCode) ?? "USD");
    setMetricMode(ssot.account.metric_display_mode ?? "rr_plus_currency");
  }, [
    ssot.loading,
    ssot.account.balance,
    ssot.account.risk_per_trade,
    ssot.account.currency,
    ssot.account.display_currency,
    ssot.account.metric_display_mode,
  ]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error("Not signed in");
      const balNum = balance.trim() === "" ? null : Number(balance);
      const riskNum = risk.trim() === "" ? null : Number(risk);
      if (balNum != null && (!Number.isFinite(balNum) || balNum < 0)) {
        throw new Error("Balance must be a positive number");
      }
      if (riskNum != null && (!Number.isFinite(riskNum) || riskNum < 0)) {
        throw new Error("Risk per trade must be a positive number");
      }

      // Keep profile in sync (acts as fallback + global preference).
      const profUpdate: {
        currency: string;
        display_currency: string;
        metric_display_mode: MetricDisplayMode;
        risk_per_trade: number | null;
        account_balance?: number;
        balance_source?: string;
        balance_updated_at?: string;
      } = {
        currency,
        display_currency: displayCurrency,
        metric_display_mode: metricMode,
        risk_per_trade: riskNum,
      };
      if (balNum != null) {
        profUpdate.account_balance = balNum;
        profUpdate.balance_source = "manual";
        profUpdate.balance_updated_at = new Date().toISOString();
      }
      const { error: pErr } = await supabase.from("profiles").update(profUpdate).eq("id", uid);
      if (pErr) throw pErr;

      // Upsert active manual account row.
      const { data: existing } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", uid)
        .eq("is_active", true)
        .maybeSingle();
      const acctPayload = {
        user_id: uid,
        is_active: true,
        source: "manual",
        balance: balNum ?? 0,
        equity: balNum ?? 0,
        currency,
        risk_per_trade: riskNum,
        updated_at: new Date().toISOString(),
      };
      if (existing?.id) {
        const { error: aErr } = await supabase
          .from("accounts")
          .update(acctPayload)
          .eq("id", existing.id);
        if (aErr) throw aErr;
      } else if (balNum != null) {
        const { error: aErr } = await supabase.from("accounts").insert(acctPayload);
        if (aErr) throw aErr;
      }

      setSavedAt(Date.now());
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(JOURNAL_EVENT));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Wallet className="h-[17px] w-[17px] text-gold" strokeWidth={1.9} />
        </div>
        <div>
          <p className="text-[14px] font-semibold tracking-tight text-text-primary">
            Account &amp; risk
          </p>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            Used everywhere the app shows monetary PnL alongside R.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label={`Account balance (${currency})`}>
          <input
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="e.g. 10000"
            className="w-full rounded-lg border border-white/[0.08] bg-[#0F1115] px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-gold/40"
          />
        </Field>
        <Field label="Currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="w-full rounded-lg border border-white/[0.08] bg-[#0F1115] px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-gold/40"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Risk per trade (${currency})`}>
          <input
            inputMode="decimal"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            placeholder="e.g. 100"
            className="w-full rounded-lg border border-white/[0.08] bg-[#0F1115] px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-gold/40"
          />
        </Field>
      </div>
      <p className="mt-2 text-[11px] text-text-secondary/80">
        Risk basis is multiplied by R values to derive PnL in {currency}. Without
        it, the dashboard only shows R.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Display currency">
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as CurrencyCode)}
            className="w-full rounded-lg border border-white/[0.08] bg-[#0F1115] px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-gold/40"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-text-secondary/70">
            What currency the app converts monetary PnL to. Historical trades keep their snapshot.
          </p>
        </Field>
        <Field label="Metric display mode">
          <select
            value={metricMode}
            onChange={(e) => setMetricMode(e.target.value as MetricDisplayMode)}
            className="w-full rounded-lg border border-white/[0.08] bg-[#0F1115] px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-gold/40"
          >
            {METRIC_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-text-secondary/70">
            {METRIC_MODES.find((m) => m.value === metricMode)?.hint}
          </p>
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-gold inline-flex items-center px-4 py-2 text-[12.5px] font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedAt && (
          <span className="text-[12px] text-emerald-400">Saved.</span>
        )}
        {error && <span className="text-[12px] text-rose-300">{error}</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({
  Icon,
  title,
  subtitle,
}: {
  Icon: typeof User;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#16181D] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-[17px] w-[17px] text-gold" strokeWidth={1.9} />
        </div>
        <div>
          <p className="text-[14px] font-semibold tracking-tight text-text-primary">
            {title}
          </p>
          <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p>
        </div>
      </div>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
        Coming soon
      </span>
    </div>
  );
}
