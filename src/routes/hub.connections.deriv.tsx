// /hub/connections/deriv — Deriv WebSocket sync.
//
// Pro: paste API token → manual "Sync now" button → trades stream into the
// unified trades table via WebSocket pulls.
// Premium: same plus an auto-sync toggle (every 15 min via pg_cron).
//
// Realtime: subscribes to public.trades for live updates so newly-synced
// rows surface without manual refresh. Connection record is also realtime.

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  Zap,
  AlertCircle,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { HubPageContainer } from "@/components/layout/HubLayout";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { supabase } from "@/integrations/supabase/client";
import {
  connectDeriv,
  syncDerivNow,
  disconnectDeriv,
  setDerivAutoSync,
} from "@/server/deriv.functions";

export const Route = createFileRoute("/hub/connections/deriv")({
  head: () => ({
    meta: [
      { title: "Deriv sync — SenecaEdge" },
      {
        name: "description",
        content:
          "Connect your Deriv account so every closed contract streams into Seneca automatically.",
      },
    ],
  }),
  component: DerivConnectionPage,
});

interface ConnectionRow {
  account_id: string | null;
  account_label: string | null;
  currency: string | null;
  balance: number | null;
  is_virtual: boolean;
  auto_sync: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

function DerivConnectionPage() {
  const { isPro, isPremium, loading: tierLoading } = useSubscriptionTier();
  const [conn, setConn] = useState<ConnectionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | "auto" | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  const connectFn = useServerFn(connectDeriv);
  const syncFn = useServerFn(syncDerivNow);
  const disconnectFn = useServerFn(disconnectDeriv);
  const autoFn = useServerFn(setDerivAutoSync);

  // Initial load + realtime
  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (alive) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("deriv_connections")
        .select(
          "account_id, account_label, currency, balance, is_virtual, auto_sync, last_synced_at, last_error",
        )
        .eq("user_id", uid)
        .maybeSingle();
      if (!alive) return;
      setConn(data as ConnectionRow | null);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel("deriv-conn-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deriv_connections" },
        () => load(),
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy("connect");
    setFeedback(null);
    try {
      const result = await connectFn({ data: { apiToken: token.trim() } });
      setToken("");
      setFeedback({
        kind: "ok",
        msg: `Connected to ${result.loginid}${result.is_virtual ? " (demo)" : ""}.`,
      });
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : "Connection failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleSync() {
    if (busy) return;
    setBusy("sync");
    setFeedback(null);
    try {
      const r = await syncFn();
      if (r.ok) {
        setFeedback({
          kind: "ok",
          msg:
            r.imported > 0
              ? `${r.imported} new trade${r.imported === 1 ? "" : "s"} synced (${r.duplicate} already in journal).`
              : `Up to date — no new closed contracts.`,
        });
      } else {
        setFeedback({ kind: "err", msg: r.error });
      }
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : "Sync failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (busy) return;
    setBusy("disconnect");
    try {
      await disconnectFn();
      setConn(null);
      setFeedback({ kind: "ok", msg: "Deriv disconnected." });
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : "Failed to disconnect",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleAuto(next: boolean) {
    if (busy) return;
    setBusy("auto");
    try {
      await autoFn({ data: { enabled: next } });
      setFeedback({
        kind: "ok",
        msg: next ? "Auto-sync enabled — syncs every 15 minutes." : "Auto-sync disabled.",
      });
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : "Failed to update auto-sync",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <HubPageContainer
      eyebrow="Deriv"
      title="WebSocket sync"
      subtitle="Stream every closed contract into your unified journal — no exports, no uploads."
    >
      <Link
        to="/hub/connections"
        className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[#9A9A9A] hover:text-[#EDEDED]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Connections
      </Link>

      {tierLoading || loading ? (
        <div className="flex items-center gap-2 text-[#9A9A9A] text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : !isPro ? (
        <ProUpgradeCard />
      ) : !conn ? (
        <ConnectForm
          token={token}
          setToken={setToken}
          onSubmit={handleConnect}
          busy={busy === "connect"}
          feedback={feedback}
        />
      ) : (
        <ConnectedPanel
          conn={conn}
          isPremium={isPremium}
          busy={busy}
          feedback={feedback}
          onSync={handleSync}
          onDisconnect={handleDisconnect}
          onToggleAuto={handleToggleAuto}
        />
      )}

      <SecurityNote />
    </HubPageContainer>
  );
}

// ---------- subcomponents ----------

function ProUpgradeCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#C6A15B]/30 bg-[#18181A] p-6"
    >
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-[#E7C98A]" />
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-[#E7C98A]">
          Pro feature
        </span>
      </div>
      <h2 className="mt-3 font-serif text-[22px] tracking-tight text-[#EDEDED]">
        Deriv sync is part of Pro.
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[#9A9A9A]">
        Pro unlocks broker connections so Seneca measures every trade you
        actually take. Premium adds automatic sync every 15 minutes.
      </p>
      <Link
        to="/hub/billing"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#C6A15B] px-5 py-2.5 text-[12.5px] font-medium text-[#0B0B0D] hover:bg-[#E7C98A]"
      >
        Upgrade to Pro
      </Link>
    </motion.div>
  );
}

function ConnectForm({
  token,
  setToken,
  onSubmit,
  busy,
  feedback,
}: {
  token: string;
  setToken: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  feedback: { kind: "ok" | "err"; msg: string } | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#C6A15B]/20 bg-[#18181A] p-6"
    >
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#C6A15B]" />
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-[#C6A15B]">
          Connect
        </span>
      </div>
      <h2 className="mt-3 font-serif text-[22px] tracking-tight text-[#EDEDED]">
        Paste your Deriv API token.
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[#9A9A9A]">
        Generate a <span className="text-[#EDEDED]/85">read-only</span> token at{" "}
        <a
          href="https://app.deriv.com/account/api-token"
          target="_blank"
          rel="noreferrer"
          className="text-[#C6A15B] hover:text-[#E7C98A] underline-offset-2 hover:underline"
        >
          app.deriv.com/account/api-token
        </a>
        . Only enable <span className="text-[#EDEDED]/85">Read</span> — Seneca never trades.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="a1b2-XXXXXXXXXXXXXXXX"
          className="w-full rounded-lg border border-white/[0.08] bg-[#0B0B0D] px-3.5 py-2.5 text-[13px] text-[#EDEDED] placeholder:text-[#9A9A9A]/60 focus:border-[#C6A15B]/40 focus:outline-none"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !token.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#C6A15B] px-4 py-2.5 text-[12.5px] font-medium text-[#0B0B0D] transition-colors hover:bg-[#E7C98A] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {busy ? "Verifying…" : "Connect Deriv"}
        </button>
      </form>

      <FeedbackLine feedback={feedback} />
    </motion.div>
  );
}

function ConnectedPanel({
  conn,
  isPremium,
  busy,
  feedback,
  onSync,
  onDisconnect,
  onToggleAuto,
}: {
  conn: ConnectionRow;
  isPremium: boolean;
  busy: "connect" | "sync" | "disconnect" | "auto" | null;
  feedback: { kind: "ok" | "err"; msg: string } | null;
  onSync: () => void;
  onDisconnect: () => void;
  onToggleAuto: (next: boolean) => void;
}) {
  const last = conn.last_synced_at
    ? new Date(conn.last_synced_at).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Never";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Account card */}
      <div className="rounded-2xl border border-[#C6A15B]/25 bg-[#18181A] p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.6)]" />
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-[#C6A15B]">
                Connected
              </span>
              {conn.is_virtual && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-[#9A9A9A]">
                  Demo
                </span>
              )}
            </div>
            <h2 className="mt-3 font-serif text-[22px] tracking-tight text-[#EDEDED]">
              {conn.account_label || conn.account_id || "Deriv account"}
            </h2>
            <p className="mt-1 text-[12px] text-[#9A9A9A]">
              Last sync: <span className="text-[#EDEDED]/85">{last}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-[#9A9A9A]">
              Balance
            </p>
            <p className="mt-1 font-serif text-[20px] text-[#EDEDED]">
              {conn.balance != null
                ? `${conn.balance.toFixed(2)} ${conn.currency ?? ""}`
                : "—"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onSync}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C6A15B] px-4 py-2.5 text-[12.5px] font-medium text-[#0B0B0D] transition-colors hover:bg-[#E7C98A] disabled:opacity-40"
          >
            {busy === "sync" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {busy === "sync" ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-[12.5px] font-medium text-[#EDEDED]/85 hover:border-white/[0.15] hover:text-[#EDEDED] disabled:opacity-40"
          >
            {busy === "disconnect" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unplug className="h-3.5 w-3.5" />
            )}
            Disconnect
          </button>
        </div>

        <FeedbackLine feedback={feedback} />

        {conn.last_error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3 text-[11.5px] text-rose-300/90">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Last error: {conn.last_error}
          </div>
        )}
      </div>

      {/* Auto-sync card */}
      <div
        className={`rounded-2xl border p-5 ${
          isPremium
            ? "border-[#C6A15B]/25 bg-[#18181A]"
            : "border-white/[0.06] bg-[#18181A]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[#E7C98A]" />
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-[#E7C98A]">
                Premium · auto-sync
              </span>
            </div>
            <p className="mt-2 text-[13px] text-[#EDEDED]/85">
              {isPremium
                ? "Seneca pulls new closed contracts every 15 minutes. No buttons, no exports."
                : "Upgrade to Premium to sync every 15 minutes automatically."}
            </p>
          </div>
          {isPremium ? (
            <button
              type="button"
              onClick={() => onToggleAuto(!conn.auto_sync)}
              disabled={busy !== null}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                conn.auto_sync ? "bg-[#C6A15B]" : "bg-white/[0.08]"
              }`}
              aria-label="Toggle auto-sync"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#0B0B0D] transition-all ${
                  conn.auto_sync ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          ) : (
            <Link
              to="/hub/billing"
              className="shrink-0 rounded-lg bg-[#C6A15B] px-3.5 py-2 text-[11.5px] font-medium text-[#0B0B0D] hover:bg-[#E7C98A]"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FeedbackLine({
  feedback,
}: {
  feedback: { kind: "ok" | "err"; msg: string } | null;
}) {
  return (
    <AnimatePresence>
      {feedback && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`mt-3 flex items-start gap-2 text-[11.5px] ${
            feedback.kind === "ok" ? "text-emerald-300/90" : "text-rose-300/90"
          }`}
        >
          {feedback.kind === "ok" ? (
            <Check className="mt-0.5 h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
          )}
          {feedback.msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function SecurityNote() {
  return (
    <div className="mt-8 rounded-2xl border border-[#C6A15B]/15 bg-[#18181A] p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-[#C6A15B] mt-0.5" />
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#C6A15B]">
            Read-only by design
          </p>
          <p className="mt-1.5 text-[13px] text-[#EDEDED]/85 leading-relaxed">
            Use a token with the <span className="text-[#EDEDED]">Read</span> scope
            only. Tokens are stored encrypted at rest and used solely to fetch
            closed contract history and balance — Seneca never opens, modifies,
            or closes positions.
          </p>
        </div>
      </div>
    </div>
  );
}
