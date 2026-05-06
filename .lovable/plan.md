
## Goal

End-to-end wiring of the centralized monetary analytics engine into `/hub`. The infrastructure (FX service, snapshots, settings persistence, schema) already exists from prior turns — this plan finishes the integration so the dashboard reads from one SSOT analytics object, supports a global currency selector with live recompute, and shows real equity instead of `$0.00`. The previously approved architecture is preserved as-is; the user's latest message is appended below as additional constraints.

---

## Part A — Active monetary architecture (unchanged, recap)

### A1. Centralized analytics object in SSOT (`src/lib/ssot.ts`)

Add `SsotAnalytics` (computed once in `loadSsot()` — no panel recomputes):

```text
analytics = {
  base_currency, display_currency, exchange_rate,
  total_r, expectancy_r, avg_r, drawdown_r,
  total_pnl_base, total_pnl_converted,
  expectancy_currency, avg_r_currency, drawdown_currency,
  starting_balance_base, equity_base, equity_converted,
}
```

Rules:
- `total_pnl_base = total_r * risk_per_trade` (null when risk basis missing).
- `equity_base = starting_balance_base + total_pnl_base`.
- `exchange_rate` fetched once via `fxService.getRate(base, display)` (DB cache → Frankfurter → exchangerate.host fallback for NGN).
- `_currency` fields = `_base * exchange_rate`. Conversion happens AFTER R-based analytics.

### A2. FX service & per-trade snapshot (already implemented — unchanged)

- `src/lib/fxService.ts` — Frankfurter + fallback, `fx_rates` cache, `formatMetric`.
- `src/lib/fxSnapshot.ts` — `attachFxSnapshotToTrade` writes immutable `monetary_pnl_base`, `exchange_rate_at_close`, `display_currency_at_close`, `monetary_pnl_converted_snapshot` once per trade.
- Hooks already integrated in `dbJournal.ts`, `tradeLogs.ts`, `MissedTradeFlow.tsx`.

### A3. Global currency selector

- New compact `<CurrencySelector />` component mounted in dashboard header.
- Writes `profiles.display_currency` and `profiles.metric_display_mode`.
- Dispatches `JOURNAL_EVENT` → `useSsot` refetches → all panels rerender. No reload.

### A4. Dashboard rewrite (`PremiumDashboard.tsx`)

- Account card: render `analytics.equity_converted` when balance + PnL known. Sublabel: "Starting + realized".
- Total PnL row + FullStatsPanel: read from `ssot.analytics`; remove inline `rToCurrency` calls.
- Hide "Set risk-per-trade in settings" copy once `risk_per_trade` is set.
- Live update via existing `useSsot` event subscriptions.

### A5. Files touched

- `src/lib/ssot.ts` — add `SsotAnalytics` type + builder in `loadSsot()`.
- `src/hooks/useSsot.tsx` — extend `EMPTY_SSOT` with empty analytics.
- `src/components/dashboard/PremiumDashboard.tsx` — read from `ssot.analytics`; mount currency selector.
- `src/components/feature/CurrencySelector.tsx` — new.
- No DB migration (schema already has all fields).

---

## Part B — APPENDED CONSTRAINTS (from latest user message)

### B1. Historical snapshot immutability — strict enforcement

**Rule**: once a trade row has `monetary_pnl_base != null`, the FX-snapshot fields are FROZEN.

- `monetary_pnl_base`
- `exchange_rate_at_close`
- `display_currency_at_close`
- `monetary_pnl_converted_snapshot`

Switching the user's `display_currency` later MUST NOT update existing trade rows. Dashboard live totals can recompute against the new rate, but per-trade history rows always render the stored snapshot.

**Enforcement points**:
- `src/lib/fxSnapshot.ts` — `attachFxSnapshotToTrade` already early-returns when `monetary_pnl_base != null`. Keep that guard.
- `src/lib/dbJournal.ts` — when editing an existing journal entry, never re-run snapshot capture; only fill snapshot if currently null (catch up legacy rows).
- `src/lib/tradeLogs.ts` — same guard on update path.
- `src/lib/trade/export.ts` (analytics export pipeline) — exports must read the stored `monetary_pnl_converted_snapshot` and `display_currency_at_close` columns, not recompute against the user's current preference. Add a compatibility path: if a row has no snapshot (legacy), fall back to live conversion AND mark the row as "live-converted" in the export so it's transparent.
- Trade history UI (`TradeHistory.tsx`, `TradeJournal.tsx`, `hub.journal.history.tsx`) — render per-row currency from the snapshot, not from `analytics.exchange_rate`.

### B2. Account balance hierarchy — strict source of truth

```text
starting_balance  (profiles.account_balance)
   └─ immutable baseline; only changed by explicit user action in /hub/settings
realized_pnl_base = sum(trades.monetary_pnl_base) over executed trades
equity_base       = starting_balance + realized_pnl_base
equity_converted  = equity_base * exchange_rate
```

**Rules**:
- Trade logging NEVER writes to `profiles.account_balance`.
- PnL only accumulates via the trades table → flows into `analytics.equity_*`.
- Broker-sync flows (deriv/MT5) may update `accounts.balance` for synced accounts but must NOT touch `profiles.account_balance` for manual users.
- Dashboard Account card displays `equity_converted` (live) and shows the immutable `starting_balance` as a sublabel: *"Starting $100,000 · Realized +$2,850"*.

**Enforcement points**:
- `src/lib/ssot.ts` `loadAccount()` — clearly separate `starting_balance_base` from `equity_base` in the analytics builder.
- `src/routes/hub.settings.tsx` — confirm only this surface writes `account_balance`.
- `src/components/dashboard/PremiumDashboard.tsx` Account card — render the breakdown.

### B3. Global metric display modes — `R_ONLY` / `CURRENCY_ONLY` / `BOTH`

Already persisted as `profiles.metric_display_mode` with values `rr_only` / `currency_only` / `rr_plus_currency`. Existing `formatMetric()` honors them. Append:

**Coverage requirement** — every analytics surface must route through `formatMetric` or read `ssot.account.metric_display_mode`:

- ✅ Dashboard (Account, Total PnL, FullStats, Performance Trend label)
- ✅ Trade History rows
- ✅ Performance Trends panel
- ✅ Behavior Breakdown monetary callouts
- ✅ Mentor insights monetary references
- ✅ Exports (CSV/PDF) — column headers and values reflect mode at export time, but per-row stored snapshots stay immutable (see B1)

**Render rules**:
- `BOTH` → `+2.85R ($5,700)`
- `CURRENCY_ONLY` → `+$5,700` (R hidden entirely from UI labels)
- `R_ONLY` → `+2.85R` (no monetary parens, no currency symbol)
- R values are invariant under currency switching.
- Currency values recompute on every `display_currency` change; never mutate stored R.

**Enforcement points**:
- Audit and refactor: `PremiumDashboard.tsx`, `TradeHistory.tsx`, `TradeJournal.tsx`, `PerformanceTrends.tsx`, `BehaviorBreakdown.tsx`, `AiMentor.tsx` quick stats, `JournalExportButton.tsx`, `src/lib/journalExport.ts`, `src/lib/trade/export.ts`, `src/lib/strategyExport.ts`.
- Single helper: every monetary render goes through `formatMetric({ r, amountInDisplayCurrency, displayCurrency, mode })` — no ad-hoc string templates.

### B4. Implementation safety

This Part B is additive. It does NOT replace:

- the centralized `SsotAnalytics` object
- `fxService` / FX cache table
- `attachFxSnapshotToTrade` immutable snapshot pipeline
- the global currency selector
- dashboard rendering refactor
- live recompute wiring via `JOURNAL_EVENT`

All previously approved files remain in scope. Part B only adds:

1. Hard-guard idempotency on snapshot writes (already partially implemented; verify all paths).
2. Settings UI clarity that `starting_balance` is immutable except by explicit edit.
3. Audit + apply `formatMetric` across every monetary surface (dashboard, history, exports, mentor, behavior).
4. Export pipeline reads from immutable per-trade snapshot columns.

## Verification checklist (post-implement)

1. Set starting_balance = 100,000, log a +2.85R trade with risk = $1000 → Account shows `$102,850 · Starting $100,000 · Realized +$2,850`.
2. Toggle display currency USD → NGN → EUR → all dashboard metrics update without reload; R values unchanged; trade history rows still show original snapshot currency.
3. Trade History row for a trade closed in USD still shows USD even after global switch to NGN.
4. Switch metric mode to `CURRENCY_ONLY` → R disappears across dashboard, history, mentor; switch to `R_ONLY` → currency parens disappear.
5. Export CSV → per-row monetary columns match the stored `monetary_pnl_converted_snapshot` + `display_currency_at_close`, not the live rate.
6. `attachFxSnapshotToTrade` second invocation on the same trade is a no-op (idempotent).
7. Logging a trade does not modify `profiles.account_balance`.

Once approved I'll switch to build mode and apply the edits in one pass, then verify with tools.
