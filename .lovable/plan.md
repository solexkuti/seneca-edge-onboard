## Goal

Upgrade the Chart Analyzer from a chart describer into a **Decision Intelligence System** — structured, multi‑layer reasoning that feels like an expert trader breaking down the market. No DB changes, no new locks, intelligence only.

## Architecture — Mandatory Layered Pipeline

```text
LAYER 0  Chart Validation Gate       →  is this a real trading chart?
LAYER 1  Structural Market Analysis  →  HH/HL/LH/LL · BOS · momentum · key zones
LAYER 2  Market Condition            →  Trending · Choppy/Consolidation · Transitional
LAYER 3  Strategy Validation         →  per-rule PASS / FAIL / NOT APPLICABLE
LAYER 4  Hidden Observation          →  non-obvious structural signals
LAYER 5  Behavioral Insight          →  psychological traps in this setup
```

Layer 0 is a hard gate — failure short‑circuits the pipeline. Layers 1–2 are strategy‑agnostic. Layer 3 is deterministic. Layers 4–5 are AI‑written, evidence‑grounded in 1–3.

---

### Layer 0 — Chart Validation Gate (harden existing)

In `supabase/functions/analyze-chart/index.ts`:
- Keep current validator schema (`has_candles`, `has_price_axis`, `has_time_axis`, `has_chart_structure`).
- Tighten threshold: require all three axis/candle flags AND `confidence >= 0.7` (was 0.6).
- On rejection, return precise reasons (already implemented).
- **No tokens spent** on Layers 1–5 for non‑charts. Prevents edge function crashes and waste.

### Layer 1 — Structural Market Analysis (rewrite)

Replace the shallow `MARKET_INTERPRETATION_SYSTEM` with a structural reasoner.

New schema fields:
- `swing_points`: `{ HH: boolean; HL: boolean; LH: boolean; LL: boolean }` — explicit swing‑point detection.
- `bos`: `{ occurred: boolean; direction: "bullish" | "bearish" | null; trigger: string | null }` — *"failure to make higher high → BOS confirmed at prior swing low"*.
- `momentum_strength`: `"strong" | "weak" | "neutral"` — based on displacement and follow‑through.
- `key_zones`: array of `{ kind: "support" | "resistance" | "supply" | "demand"; note: string }`.
- `is_pullback_or_shift`: `"pullback" | "structural_shift" | "indeterminate"` — kills "price went up then down" generic.
- `summary`: 2–3 sentence structural explanation.

Prompt rules (strict):
- Must read like: *"Market failed to create a higher high and broke previous structure, signaling a bearish shift. Momentum on the breakdown is strong with full‑body displacement."*
- Banned: should, must, buy, sell, enter, exit, target, take profit, stop loss, wait for, expect, look to, recommend, advise.
- Allowed analytical: shows, indicates, confirms, lacks, fails to, reads as, signals, increases probability of, reduces probability of.
- Model: upgrade this single call to `google/gemini-2.5-pro`. Validation + feature extraction stay on `gemini-2.5-flash` to control cost.

### Layer 2 — Market Condition Classification (deterministic)

New file `src/lib/marketCondition.ts`. Inputs come from feature extraction + Layer 1 swing/momentum fields.

Output:
```ts
type MarketCondition = {
  label: "trending" | "choppy" | "transitional";
  bias: "bullish" | "bearish" | "neutral";
  clarity: "high" | "medium" | "low";
  reasoning: string[];   // bullets explaining WHY this label
  signals: {
    candle_overlap: "low" | "medium" | "high";   // chop proxy from new AI field
    swing_progression: "clear" | "mixed" | "absent";  // HH/HL or LH/LL clean?
    direction_flips: "few" | "some" | "frequent";
  };
};
```

Choppiness detection logic (deterministic, per the user's spec):
- `choppy` when ≥2 of: high candle_overlap, swing_progression=absent, frequent direction flips.
- `transitional` when `bos.occurred=true` OR (momentum=weak AND swing_progression=mixed).
- Else `trending`.

Bias derived from swing pattern (HH+HL → bullish, LH+LL → bearish, mixed → neutral). Clarity derived from candle_overlap + swing_progression.

To support this, extend extraction schema with one new field: `candle_overlap: "low" | "medium" | "high"`.

### Layer 3 — Strategy Validation (sharpened language)

In `src/lib/strategyAlignment.ts`:

- Kill the overused `"Not directly observable from a static chart — confirm manually."` default. Replace per category:
  - Confirmation candle/indicator → *"Condition not visible on this chart — requires live indicator state."*
  - Numeric risk → *"Numeric risk parameter — verified on the trade ticket, not the chart."*
  - Session / news / time → *"Requires additional context (session/time/news)."*
  - Behavioral → *"Self‑reported condition — outside chart scope."*
- Every FAIL gets a structured reason: **expected · missing · impact**:
  - Liquidity sweep → *"Expected: liquidity sweep before entry. Missing: no prior high/low taken before the move. Impact: reduces probability of institutional participation."*
  - BOS → *"Expected: confirmed break of structure. Missing: no clean break of prior swing. Impact: directional thesis is unverified."*
  - HTF alignment → *"Expected: HTF alignment with execution. Missing: HTF reads {x} while exec reads {y}. Impact: counter‑trend setups underperform under your rules."*

### Layer 4 — Hidden Observation (new AI step)

New TanStack Start server function — **not** a Supabase Edge Function — at `src/server/chartIntelligence.functions.ts` (per project's modern stack guidance: prefer `createServerFn` over edge functions for app logic).

Wait — the rest of the analyzer pipeline is in a Supabase Edge Function. To stay consistent with the existing code path and avoid splitting the call surface, this single new step lives **in the same edge function** as a follow‑up AI call after extraction completes:

- Inputs: Layer 1 structural analysis, Layer 2 market condition, Layer 3 alignment results.
- Output schema (tool calling, single call):
  ```ts
  {
    trade_quality_reason: string[],   // bullets for Trade Grade "Reason"
    conclusion: string,               // 1-line system verdict
    hidden_observation: string,       // non-obvious structural insight
    behavioral_insight: string,       // psychological trap latent in setup
    insight: string,                  // mentor-grade synthesis (3-4 sentences)
  }
  ```
- `hidden_observation` examples:
  - *"Momentum is weakening on each push higher — full‑body candles are giving way to upper wicks, an early sign of distribution before the structure breaks."*
  - *"The 'breakout' did not take true external liquidity — only internal range liquidity. Smart‑money continuation is structurally less likely."*
- `behavioral_insight` examples:
  - *"This is the pattern that triggers early entries — a clean‑looking structure into a transitional environment without confirmation."*
  - *"Chasing momentum is the trap here: the move is mature, displacement is fading, and a re‑entry from a stronger zone is the harder but cleaner play."*
- Tone: focusing language allowed (*"Focus on …"*, *"Notice that …"*, *"The trap here is …"*); advisory verbs banned.
- Every claim references evidence from Layers 1–3 — no free‑form speculation.
- Model: `google/gemini-2.5-pro`.
- Failure non‑blocking: Layers 0–3 always render; Layer 4–5 cards hidden if call fails.

### Confidence System (mandatory breakdown)

New file `src/lib/analyzerConfidence.ts`. Replace single `AI confidence 86%` chip with a `ConfidenceBreakdownCard`:

```text
ANALYSIS CONFIDENCE: 72%

Structure clarity     ███████░░░  74%
Trend strength        ██████░░░░  62%
Confirmation signals  ███████░░░  78%

Why: Moderate structure clarity (mixed swing progression),
weak momentum on the latest leg, partial confirmation present.
```

Computed deterministically:
- `structure_clarity` = derived from `quality` + `swing_progression` + Layer 1 BOS clarity.
- `trend_strength` = derived from `momentum_strength` + `displacement_quality`.
- `confirmation_signals` = % of strategy confirmation rules that are observable AND satisfied on this chart (inverse of "no_setup" risk).
- `overall` = weighted average (0.4 / 0.35 / 0.25).
- `why` text generated deterministically from the weakest sub‑score.

### Trade Grade (restructured)

`TradeGradeCard` in `ChartAnalyzer.tsx`:

```text
TRADE QUALITY: C+
Alignment: 0%

Reason
• Core entry condition missing: liquidity sweep
• No confirmation of structural break

Conclusion
Low-probability setup based on missing core entry condition.
```

- Reason bullets: from `trade_quality_reason` (Layer 4) when present, else top failed rules.
- Conclusion: from `conclusion` field, else deterministic fallback derived from grade.
- Grade scale: A+ (≥80) · B+ (≥55) · C+ (<55) — already implemented.

### UI Composition (top-down)

In `src/components/feature/ChartAnalyzer.tsx` `ResultView`:

1. Chart preview(s) — unchanged.
2. **Structural Analysis** card (Layer 1): summary + BOS callout when `bos.occurred=true`. Eyebrow: *"Market structure"*.
3. **Market Condition** card (Layer 2): label + bias + clarity badges + `reasoning` bullets + `signals` mini‑grid. Color tone by label (gold for trending, muted amber for transitional, muted rose for choppy).
4. **Trade Grade** card (Layer 3): restructured Reason + Conclusion.
5. **Strategy Alignment** (expandable, per‑rule PASS/FAIL/NA — sharpened language).
6. **Detailed Breakdown** (collapsible) — unchanged shape.
7. **Hidden Observation** card (Layer 4): muted‑gold ring, sparkle icon, eyebrow *"Hidden Observation"*. Hidden when null.
8. **Behavioral Insight** card (Layer 5): warm amber ring, eyebrow *"Behavioral Insight"*. Hidden when null.
9. **Insight** card: `aiInsight.insight` mentor synthesis with deterministic fallback.
10. **Confidence Breakdown** card.
11. **Disclaimer**: *"This analysis is for informational purposes only and does not constitute financial advice. Market conditions can change and all trading involves risk."* (already present in `ANALYZER_DISCLAIMER`).
12. Actions (New analysis · Saved) — unchanged.

All cards follow the project's Dark + Gold identity (per memory). No `bg-white`, gold accents on intentional surfaces only.

### Tone Control (single shared list, enforced in all prompts)

- **Banned**: should, must, buy, sell, enter, exit, take profit, stop loss, wait for, target, look to, expect, recommend, advise.
- **Allowed analytical**: shows, indicates, confirms, lacks, fails to, reads as, signals, increases probability of, reduces probability of.
- **Allowed mentor (Layer 4–5 only)**: focus on, notice that, consider that, the trap here is.

System reinforces discipline by **explaining**, never enforces by blocking.

## Files Touched

- `supabase/functions/analyze-chart/index.ts` — rewrite Layer 1 prompt + schema (swing points, BOS, momentum, key zones, pullback‑vs‑shift), add `candle_overlap` to extraction, add Layer 4–5 AI call (`gemini‑2.5-pro`) returning `trade_quality_reason / conclusion / hidden_observation / behavioral_insight / insight`, raise validation threshold to 0.7. No DB changes.
- `src/lib/marketCondition.ts` — **new** deterministic Layer 2 classifier (chop logic per user spec).
- `src/lib/analyzerConfidence.ts` — **new** confidence breakdown calculator + WHY text.
- `src/lib/strategyAlignment.ts` — sharpen reason strings (kill "not observable" boilerplate; expected/missing/impact format).
- `src/components/feature/ChartAnalyzer.tsx` — wire Layer 1 fields, Layer 2 condition, Layer 4–5 AI fields, confidence breakdown; new `StructuralAnalysisCard`, `MarketConditionCard`, `HiddenObservationCard`, `BehavioralInsightCard`, `ConfidenceBreakdownCard`; restructured `TradeGradeCard` (Reason + Conclusion).

## Hard Rules Preserved

- **No DB migrations** — all new fields live in component state.
- **No new locks / gates** — analyzer is intelligence, never enforcement (per project memory).
- Disclaimer always rendered.
- Layers 0–3 always render; Layer 4–5 fail silently.
- Every output answers **why**, not just **what**.
- Dark + Gold identity preserved across all new cards.
