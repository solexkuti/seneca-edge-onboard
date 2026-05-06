// CurrencySelector — global, header-mounted control for display currency
// and metric display mode. Writes to profiles, dispatches JOURNAL_EVENT so
// useSsot recomputes analytics across the entire app without a reload.

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSsot } from "@/hooks/useSsot";
import {
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  type MetricDisplayMode,
} from "@/lib/ssot";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";

const MODE_LABEL: Record<MetricDisplayMode, string> = {
  rr_only: "R only",
  rr_plus_currency: "R + $",
  currency_only: "$ only",
};

export default function CurrencySelector() {
  const { ssot } = useSsot();
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [mode, setMode] = useState<MetricDisplayMode>("rr_plus_currency");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ssot.loading) return;
    setCurrency((ssot.account.display_currency as CurrencyCode) ?? "USD");
    setMode(ssot.account.metric_display_mode ?? "rr_plus_currency");
  }, [ssot.loading, ssot.account.display_currency, ssot.account.metric_display_mode]);

  async function persist(next: { display_currency?: string; metric_display_mode?: MetricDisplayMode }) {
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      await supabase.from("profiles").update(next).eq("id", uid);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(JOURNAL_EVENT));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#16181D] px-2.5 py-1.5">
      <Globe2 className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
      <select
        aria-label="Display currency"
        disabled={busy}
        value={currency}
        onChange={(e) => {
          const v = e.target.value as CurrencyCode;
          setCurrency(v);
          void persist({ display_currency: v });
        }}
        className="bg-transparent text-[12px] font-semibold tracking-wide text-text-primary outline-none"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c} className="bg-[#16181D]">
            {c}
          </option>
        ))}
      </select>
      <span className="h-3 w-px bg-white/10" aria-hidden />
      <select
        aria-label="Metric display mode"
        disabled={busy}
        value={mode}
        onChange={(e) => {
          const v = e.target.value as MetricDisplayMode;
          setMode(v);
          void persist({ metric_display_mode: v });
        }}
        className="bg-transparent text-[12px] font-semibold tracking-wide text-text-secondary outline-none"
      >
        {(Object.keys(MODE_LABEL) as MetricDisplayMode[]).map((m) => (
          <option key={m} value={m} className="bg-[#16181D]">
            {MODE_LABEL[m]}
          </option>
        ))}
      </select>
    </div>
  );
}
