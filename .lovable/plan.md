# Restore the old "Trading Coach" dashboard

The data layer (BehaviorStateProvider, metricsEngine, trades→trades mirroring) is correct and stays untouched. Only the dashboard's **composition and hierarchy** change. No placeholder data.

## Target structure (strict order)

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: "Welcome back." + subtle "Open Analyzer" CTA         │
├──────────────────────────────────────────────────────────────┤
│ 1. CORE PERFORMANCE METRICS — single horizontal strip        │
│    Win Rate · Total R · Avg R · Profit Factor · Expectancy   │
│    · Max Drawdown                                            │
│    Answers: "Am I profitable?"                               │
├──────────────────────────────────────────────────────────────┤
│ 2. TRADE HISTORY — visually dominant table                   │
│    Date · Asset · Dir · Result (R) · Rules Broken (tags) ·   │
│    Discipline % · Notes icon                                 │
│    "Show all trades" expander · "Last 10 trades" badge       │
│    Answers: "What did I do?"                                 │
├──────────────────────────────────────────────────────────────┤
│ 3. BEHAVIOR BREAKDOWN — diagnosis                            │
│    Behavior Score (0–100) + Rule Adherence %                 │
│    Rule violations ranked by |R impact|, each row:           │
│      Rule · Times · Last broken · Total R impact             │
│    Answers: "What is killing me?"                            │
├──────────────────────────────────────────────────────────────┤
│ 4. PERFORMANCE TREND — supporting equity curve in R          │
└──────────────────────────────────────────────────────────────┘
Floating: subtle Edge Alert pill (bottom-left), Mentor orb (bottom-right)
```

## Removed / demoted from the main dashboard

- **System edge / Actual performance / Missed R / Execution gap** top bar — gone from main view.
- **"Left on the table" missed-R headline banner** — gone.
- **Edge vs Execution chart** — removed from dashboard (still available inside Insights/Analyzer if needed later).
- **Patterns detected sidebar** — folded into Behavior Breakdown only as a small "Detected pattern" note under the violations list when severity ≥ warn. No standalone section.
- **Best session card** — removed from main dashboard (lives in Insights).
- **Behavior timeline** — removed from main dashboard (lives in Insights/journal history).
- **Edge Alert** — kept only as the existing subtle floating pill; no card on the dashboard body.
- **AI Mentor card** — already separate route; ensure no Mentor block is rendered inline.

## Discipline score — transparent

- Start at 100. Per-trade penalties applied to a 100 baseline:
  - `entered_without_confirmation` → −25
  - `ignored_stop_loss` / `no_stop_loss` → −25
  - `moved_stop_loss` → −10
  - `fomo_entry` / `early_entry` → −10
  - `overtrading` → −10
  - `revenge_trade` → −15
  - `counter_trend_entry` → −10
  - `early_exit` → −10
  - any other rule break → −10 (default)
- Per-trade discipline shown in the trade-history row.
- Aggregate discipline = average of last 20 executed trades' per-trade scores (falls back to all if fewer). Rule adherence % = clean trades / executed trades.
- Both numbers come from a single helper in `metricsEngine.ts` so Dashboard, Mentor, and Alerts read identical values.

## Files

### Edit
1. **`src/components/edge/EdgeDashboard.tsx`** — rebuild the layout to the 4-section structure above. Keep `useEdgeData` (SSOT), keep the trade-detail Modal, keep header CTA, drop everything listed under "Removed / demoted".
2. **`src/lib/edge/metricsEngine.ts`** — add:
   - `computePerTradeDiscipline(trade)` using the penalty map above.
   - update `computeBehaviorMetrics` so `discipline_score` uses average of last 20 per-trade scores (replaces the current 60/40 blend) and exposes the penalty map for the UI.
   - extend `ViolationGroup` with `last_occurred_at` formatted nicely (already there) — no change.

### Create
3. **`src/components/edge/CoreMetricsStrip.tsx`** — section 1. Six tiles in one row (responsive 2/3/6). Uses `performance_metrics`. Always renders, zeros when empty + soft "Log your first trade" hint.
4. **`src/components/edge/TradeHistoryTable.tsx`** — section 2. Table of last 10 trades from `state.trades` (sorted desc), with summary header (`Total trades`, `Win rate`, `Avg R`, `Total R`), per-row rule-break tags, per-row discipline % bar, click opens existing trade Modal, "Show all trades" link to `/hub/trades`.
5. **`src/components/edge/BehaviorBreakdownSection.tsx`** — section 3. Replaces sidebar usage of `BehaviorBreakdownPanel`. Score + Adherence on top, then a ranked violations table (`Rule · Times · Last broken · Impact R`), then the existing rule-violations sparkline if useful. Empty state: "No rule breaks yet — clean execution."
6. **`src/components/edge/PerformanceTrendSection.tsx`** — section 4. Thin wrapper around existing `EquityCurveChart`, single title "Performance trend", no extra overlays.

### Leave intact (SSOT + sync)
- `src/lib/edge/BehaviorStateProvider.tsx`, `src/lib/edge/useEdgeData.ts`, `src/routes/hub.tsx`, `src/components/feature/BehavioralJournalFlow.tsx`, the `trade_logs → trades` mirror trigger. These already guarantee the Dashboard, Mentor, and Alerts read the same source and refresh in real time after a trade is logged.

## Empty / first-trade behavior

- 0 trades → all 4 sections render with zero/baseline values; subtle italic line under Core Metrics: *"Your discipline starts at 100. Protect it."* (kept from prior fix).
- 1 trade → Core Metrics, Trade History (1 row), Behavior Breakdown, and Trend all populate instantly from the realtime SSOT subscription. No reload, no hidden sections.

## Acceptance checklist

1. Dashboard hierarchy top-to-bottom is exactly: Core Metrics → Trade History → Behavior Breakdown → Performance Trend. No other sections in the main flow.
2. No "System edge", "Actual performance", "Missed R", "Execution gap", "Edge vs Execution chart", "Patterns detected" sidebar, "Best session", or "Behavior timeline" appears on the dashboard.
3. After logging a trade in the journal, all 4 sections update without refresh, and discipline % per trade matches the documented penalty map.
4. Trade History is visually the largest section.
5. Edge Alert remains only as the existing subtle floating pill.