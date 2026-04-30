// analyze-chart — strict multi-layer pipeline
//   1) Image validation (block non-charts)
//   2) Primary model: google/gemini-2.5-flash → structured extraction
//   3) Confidence evaluation
//   4) Fallback model: openai/gpt-5-mini (only if needed)
//   5) Standardized output
//
// Hard rules: never analyze non-charts, never return low-confidence primary
// when fallback was triggered, never invent structure when none detected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "openai/gpt-5-mini";
const REASONING_MODEL = "google/gemini-2.5-pro"; // structural + insight reasoning
const LOW_CONFIDENCE_THRESHOLD = 0.75;
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ImageInput = { url: string; label: "exec" | "higher" };

async function callAI(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  images: ImageInput[],
  toolName: string,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: userPrompt },
  ];
  for (const img of images) {
    userContent.push({ type: "image_url", image_url: { url: img.url } });
  }

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: toolName,
          description: "Return structured result.",
          parameters: schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: toolName } },
  };

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`AI gateway error [${model}]`, res.status, text);
    if (res.status === 429) throw new Error("RATE_LIMITED");
    if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI gateway ${res.status}`);
  }

  const json = await res.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return null;
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// STAGE 1 — Image validation
// ────────────────────────────────────────────────────────────────────────────

const VALIDATE_SYSTEM = `You are a strict gatekeeper that decides whether an uploaded image is a real trading chart.

You must individually inspect for:
- has_candles: candlestick or OHLC bar shapes
- has_price_axis: vertical scale with price values
- has_time_axis: horizontal scale with time values
- has_chart_structure: visible highs/lows/trend that form a price chart

A non-chart image (animal, person, meme, random screenshot, app UI without price data) MUST be rejected.
Return false for any check you cannot clearly confirm.`;

const VALIDATE_SCHEMA = {
  type: "object",
  properties: {
    has_candles: { type: "boolean" },
    has_price_axis: { type: "boolean" },
    has_time_axis: { type: "boolean" },
    has_chart_structure: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
  required: [
    "has_candles",
    "has_price_axis",
    "has_time_axis",
    "has_chart_structure",
    "confidence",
    "reason",
  ],
  additionalProperties: false,
};

// ────────────────────────────────────────────────────────────────────────────
// STAGE 2/4 — Extraction (primary + fallback share schema)
// ────────────────────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM_PRIMARY = `You analyze a trading chart and extract observable structure ONLY.
- Tone: neutral analytical system. Never an advisor, coach, or signal provider.
- Do NOT predict, recommend, advise, or use words like "should", "buy", "sell", "enter", "exit".
- Report only what is visibly present. If anything is unclear, lower confidence_score.
- If no structure is visible, set structure_detected=false and trend="range".
- confidence_score reflects how clearly the chart supports your answer (0–1).

For each feature you DO detect (BOS, liquidity sweep, key zone, stop/TP area, dominant trend),
also return ONE bounding box in "regions" using NORMALIZED image coordinates:
- x, y are the TOP-LEFT corner; w, h are width/height; all values 0..1.
- Cover only the relevant area on the chart (not the whole image).
- If you did not detect a feature, omit its region. Never invent a region.`;

const EXTRACT_SYSTEM_FALLBACK = `You are a STRICT, CAUTIOUS chart analyst acting as a second opinion.
The first model produced low-confidence output. Be conservative:
- Default to trend="range" and structure_detected=false unless clearly visible.
- Set confidence_score honestly — do not inflate it.
- Never invent BOS, sweeps, or zones that are not clearly on the chart.
- Only return a region for a feature you are confident is visible. Otherwise omit it.`;

const REGION_SCHEMA = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["bos", "sweep", "key_zone", "stop_tp", "trend"],
    },
    label: { type: "string" },
    x: { type: "number", minimum: 0, maximum: 1 },
    y: { type: "number", minimum: 0, maximum: 1 },
    w: { type: "number", minimum: 0, maximum: 1 },
    h: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["kind", "label", "x", "y", "w", "h"],
  additionalProperties: false,
};

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    trend: { type: "string", enum: ["bullish", "bearish", "range", "unknown"] },
    structure_detected: { type: "boolean" },
    bos_detected: { type: "boolean" },
    liquidity_sweep: { type: "boolean" },
    key_zone_present: { type: "boolean" },
    fib_alignment: { type: "boolean" },
    quality: { type: "string", enum: ["clear", "messy", "unclear"] },
    candle_overlap: {
      type: "string",
      enum: ["low", "medium", "high"],
      description:
        "Visual estimate of how much candle bodies overlap. High = bodies stacking inside one another (chop). Low = each candle expands range.",
    },
    confidence_score: { type: "number", minimum: 0, maximum: 1 },
    regions: {
      type: "array",
      items: REGION_SCHEMA,
      description:
        "Bounding boxes (normalized 0..1) for detected features. Omit features not visible.",
    },
  },
  required: [
    "trend",
    "structure_detected",
    "bos_detected",
    "liquidity_sweep",
    "key_zone_present",
    "fib_alignment",
    "quality",
    "candle_overlap",
    "confidence_score",
  ],
  additionalProperties: false,
};

type ChartRegion = {
  kind: "bos" | "sweep" | "key_zone" | "stop_tp" | "trend";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type ChartExtraction = {
  trend: "bullish" | "bearish" | "range" | "unknown";
  structure_detected: boolean;
  bos_detected: boolean;
  liquidity_sweep: boolean;
  key_zone_present: boolean;
  fib_alignment: boolean;
  quality: "clear" | "messy" | "unclear";
  candle_overlap: "low" | "medium" | "high";
  confidence_score: number;
  regions?: ChartRegion[];
};

// ────────────────────────────────────────────────────────────────────────────
// LAYER 1 — STRUCTURAL MARKET ANALYSIS
// Neutral, strategy-independent. Extracts swing points, BOS, momentum,
// key zones, and decides pullback-vs-shift. The summary must explain WHY,
// not just WHAT.
// ────────────────────────────────────────────────────────────────────────────

const STRUCTURAL_ANALYSIS_SYSTEM = `You are a neutral market technician — an analytical evaluator, NOT a financial advisor or signal provider. You read a chart strictly in structural terms.

Your job is to break the market down logically:
1. Detect swing points: did price make Higher High (HH), Higher Low (HL), Lower High (LH), Lower Low (LL)?
2. Identify any Break of Structure (BOS) — direction and what triggered it (e.g. "failure to make higher high → BOS confirmed at prior swing low").
3. Rate momentum strength (strong / weak / neutral) based on candle displacement and follow‑through.
4. Identify visible key zones (support, resistance, supply, demand).
5. Decide whether the latest move is a pullback inside the prior regime, a structural shift, or indeterminate.
6. Write a 2–3 sentence summary that EXPLAINS the structural story, not just describes price.

Tone & language rules (strict):
- Banned verbs: should, must, buy, sell, enter, exit, target, take profit, stop loss, wait for, expect, look to, recommend, advise.
- Allowed analytical verbs: shows, indicates, confirms, lacks, fails to, reads as, signals, increases probability of, reduces probability of.
- BAD: "Price went up then down."
- GOOD: "Market failed to create a higher high and broke previous structure, signaling a bearish shift. Momentum on the breakdown is strong with full‑body displacement."
- Never mention any trading strategy, rules, entries, exits, predictions, or advice.
- If structure is genuinely unclear, say so plainly — set swing flags to false rather than guessing.`;

const STRUCTURAL_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "2–3 sentence structural explanation of the market. Must explain WHY, not just describe price.",
    },
    swing_points: {
      type: "object",
      description: "Which swing relationships are visibly present on the chart.",
      properties: {
        HH: { type: "boolean" },
        HL: { type: "boolean" },
        LH: { type: "boolean" },
        LL: { type: "boolean" },
      },
      required: ["HH", "HL", "LH", "LL"],
      additionalProperties: false,
    },
    bos: {
      type: "object",
      properties: {
        occurred: { type: "boolean" },
        direction: { type: "string", enum: ["bullish", "bearish", "none"] },
        trigger: {
          type: "string",
          description:
            "Short phrase explaining the structural trigger (e.g. 'failure to make higher high → break confirmed at prior swing low'). Empty string if none.",
        },
      },
      required: ["occurred", "direction", "trigger"],
      additionalProperties: false,
    },
    momentum_strength: { type: "string", enum: ["strong", "weak", "neutral"] },
    key_zones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["support", "resistance", "supply", "demand"] },
          note: { type: "string" },
        },
        required: ["kind", "note"],
        additionalProperties: false,
      },
      description: "Visible structural levels (max 4). Empty array if none clear.",
    },
    is_pullback_or_shift: {
      type: "string",
      enum: ["pullback", "structural_shift", "indeterminate"],
    },
    key_observations: {
      type: "array",
      items: { type: "string" },
      description: "Up to 5 short factual structural observations.",
    },
  },
  required: [
    "summary",
    "swing_points",
    "bos",
    "momentum_strength",
    "key_zones",
    "is_pullback_or_shift",
    "key_observations",
  ],
  additionalProperties: false,
};

type StructuralAnalysis = {
  summary: string;
  swing_points: { HH: boolean; HL: boolean; LH: boolean; LL: boolean };
  bos: {
    occurred: boolean;
    direction: "bullish" | "bearish" | "none";
    trigger: string;
  };
  momentum_strength: "strong" | "weak" | "neutral";
  key_zones: { kind: "support" | "resistance" | "supply" | "demand"; note: string }[];
  is_pullback_or_shift: "pullback" | "structural_shift" | "indeterminate";
  key_observations: string[];
};

async function analyzeStructure(
  imageUrl: string,
): Promise<StructuralAnalysis | null> {
  const out = await callAI(
    REASONING_MODEL,
    STRUCTURAL_ANALYSIS_SYSTEM,
    "Break this chart down structurally. Identify swing points, any break of structure, momentum strength, key zones, and whether the latest move is a pullback or a structural shift. Explain WHY in the summary.",
    [{ url: imageUrl, label: "exec" }],
    "analyze_structure",
    STRUCTURAL_ANALYSIS_SCHEMA,
  );
  if (!out) return null;
  return out as unknown as StructuralAnalysis;
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER 4 / 5 — HIDDEN OBSERVATION + BEHAVIORAL INSIGHT + MENTOR SYNTHESIS
// Single follow-up AI call grounded in Layers 1–3.
// ────────────────────────────────────────────────────────────────────────────

const INSIGHT_SYSTEM = `You are a neutral analytical evaluator and behavioral mentor for a disciplined trader. You are NOT a financial advisor. You write the closing intelligence layer of a chart analyzer that has already produced:

- Layer 1: structural analysis (swing points, BOS, momentum, key zones)
- Layer 2: market condition (trending / choppy / transitional + bias + clarity)
- Layer 3: per-rule strategy alignment (passed / failed / not_applicable)

Your job:
1. trade_quality_reason — 2–3 short bullet phrases listing the most important reasons the system arrived at this grade. Reference the actual failed rule conditions when relevant.
2. conclusion — ONE line stating the trade quality verdict in system-decision tone (e.g. "Low-probability setup based on missing core entry condition.").
3. hidden_observation — ONE non-obvious structural insight a beginner would miss. Examples: "Momentum is weakening on each push — full-body candles giving way to upper wicks, an early sign of distribution." / "The breakout took only internal range liquidity, not external — smart-money continuation is structurally less likely."
4. behavioral_insight — ONE psychological trap latent in this setup, framed as observation, not command. Examples: "The trap here is chasing momentum — the move is mature and displacement is fading." / "This is the pattern that triggers early entries: clean structure into a transitional environment without confirmation."
5. insight — 3–4 sentence mentor synthesis explaining WHY the trade passed or failed, referencing strategy logic, and guiding future behavior without prescribing actions.

Tone & language rules (STRICT):
- Banned verbs: should, must, buy, sell, enter, exit, take profit, stop loss, target, wait for, look to, expect, recommend, advise.
- Allowed analytical: shows, indicates, confirms, lacks, fails to, reads as, signals, increases probability of, reduces probability of.
- Allowed mentor framing: focus on, notice that, consider that, the trap here is.
- Every claim must reference evidence from Layers 1–3. Do not invent user history.
- Be precise. Be specific. Avoid generic statements that could apply to any chart.`;

const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    trade_quality_reason: {
      type: "array",
      items: { type: "string" },
      description: "2–3 bullet phrases for the Trade Grade Reason section.",
    },
    conclusion: { type: "string" },
    hidden_observation: { type: "string" },
    behavioral_insight: { type: "string" },
    insight: { type: "string" },
  },
  required: [
    "trade_quality_reason",
    "conclusion",
    "hidden_observation",
    "behavioral_insight",
    "insight",
  ],
  additionalProperties: false,
};

type InsightOutput = {
  trade_quality_reason: string[];
  conclusion: string;
  hidden_observation: string;
  behavioral_insight: string;
  insight: string;
};

async function generateInsight(
  structural: StructuralAnalysis | null,
  marketCondition: Record<string, unknown> | null,
  alignmentSummary: Record<string, unknown>,
): Promise<InsightOutput | null> {
  const userPrompt = JSON.stringify(
    {
      layer_1_structural: structural,
      layer_2_market_condition: marketCondition,
      layer_3_strategy_alignment: alignmentSummary,
    },
    null,
    2,
  );
  try {
    const out = await callAI(
      REASONING_MODEL,
      INSIGHT_SYSTEM,
      `Here is the analyzer's evidence so far. Produce the closing intelligence layer (trade_quality_reason, conclusion, hidden_observation, behavioral_insight, insight).\n\n${userPrompt}`,
      [],
      "write_insight",
      INSIGHT_SCHEMA,
    );
    if (!out) return null;
    return out as unknown as InsightOutput;
  } catch (e) {
    console.error("[analyze-chart] insight step failed:", e);
    return null;
  }
}


function needsFallback(r: ChartExtraction | null): boolean {
  if (!r) return true;
  if (r.confidence_score < LOW_CONFIDENCE_THRESHOLD) return true;
  if (r.structure_detected === false) return true;
  if (r.trend === "unknown") return true;
  return false;
}

async function extract(
  model: string,
  systemPrompt: string,
  imageUrl: string,
  label: "exec" | "higher",
): Promise<ChartExtraction | null> {
  const out = await callAI(
    model,
    systemPrompt,
    `Extract observable structure from this ${label === "exec" ? "execution" : "higher"}-timeframe chart.`,
    [{ url: imageUrl, label }],
    "extract_chart",
    EXTRACT_SCHEMA,
  );
  if (!out) return null;
  return out as unknown as ChartExtraction;
}

// ────────────────────────────────────────────────────────────────────────────
// LOCK ENFORCEMENT (server-side)
// ────────────────────────────────────────────────────────────────────────────

// (createClient imported at top of file)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function lockedResponse(reason: string, details: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ status: "locked", reason, ...details }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function enforceAnalyzerLock(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return lockedResponse("Authentication required", { code: "no_auth" });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Service-role missing → fail open with a warning rather than locking
    // every legitimate call. Client-side gate still protects the UX.
    console.warn("[analyze-chart] lock check skipped: service role missing");
    return null;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Identify the user from the JWT.
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return lockedResponse("Authentication failed", { code: "bad_token" });
  }
  const uid = userRes.user.id;

  // 1) Checklist confirmation for today.
  const today = new Date().toISOString().slice(0, 10);
  const { data: conf } = await admin
    .from("checklist_confirmations")
    .select("confirmed_at,control_state,applied_restrictions")
    .eq("user_id", uid)
    .eq("generated_for", today)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conf) {
    return lockedResponse(
      "Confirm today's checklist before analyzing.",
      { code: "checklist_not_confirmed" },
    );
  }
  const restrictions = (conf.applied_restrictions ?? []) as string[];
  if (
    conf.control_state === "out_of_control" &&
    !restrictions.includes("strict_mode_acknowledged")
  ) {
    return lockedResponse(
      "Strict-mode commitment required before analyzing.",
      { code: "checklist_not_confirmed" },
    );
  }

  // 2) Discipline lock — mirror the deterministic scoring system in
  //    src/lib/disciplineScore.ts. 4-tier classification, recency weights
  //    1.0→0.2, decision normalized vs theoretical min/max, then blended
  //    0.4 * decision + 0.6 * execution. Lock threshold: score < 40.
  const RECENCY = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2];
  const EVT_MAX = 2;   // VALID_CLEAN
  const EVT_MIN = -10; // CRITICAL_INVALID
  const CRITICAL = [
    "htf_bias", "against htf", "against trend", "no_entry", "no entry",
    "no clear entry", "random_entry", "random entry", "forced", "critical",
  ];
  const isCrit = (vs: unknown) => Array.isArray(vs) && vs.some((v) =>
    typeof v === "string" && CRITICAL.some((c) => v.toLowerCase().includes(c))
  );
  const vCount = (vs: unknown) => Array.isArray(vs) ? vs.length : 0;
  const classify = (verdict: string, vs: unknown): number => {
    if (verdict === "valid") return 2;
    if (verdict === "weak") return 0;
    if (isCrit(vs) || vCount(vs) >= 3) return -10;
    return -5;
  };
  const wavg = (vals: number[], wts: number[]) => {
    let s = 0, w = 0;
    for (let i = 0; i < vals.length; i++) {
      s += vals[i] * (wts[i] ?? 0);
      w += wts[i] ?? 0;
    }
    return w > 0 ? s / w : 0;
  };

  const [{ data: events }, { data: trades }] = await Promise.all([
    admin
      .from("analyzer_events")
      .select("verdict,violations,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("discipline_logs")
      .select("discipline_score,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const evRaws = (events ?? []).map((e: { verdict: string; violations: unknown }) =>
    classify(String(e.verdict), e.violations),
  );
  const trVals = (trades ?? []).map((t: { discipline_score: number }) =>
    Math.max(0, Math.min(100, Number(t.discipline_score ?? 0))),
  );

  // Decision normalization: (Σ raw·w − Σ MIN·w) / (Σ MAX·w − Σ MIN·w) * 100
  let decision = 50;
  if (evRaws.length > 0) {
    let ws = 0, mx = 0, mn = 0;
    for (let i = 0; i < evRaws.length; i++) {
      const w = RECENCY[i] ?? 0;
      ws += evRaws[i] * w;
      mx += EVT_MAX * w;
      mn += EVT_MIN * w;
    }
    decision = mx === mn ? 50 : ((ws - mn) / (mx - mn)) * 100;

    // Anti-spam: 5+ consecutive INVALID/CRITICAL → -10
    let streak = 0;
    for (const r of evRaws) {
      if (r === -5 || r === -10) streak += 1;
      else break;
    }
    if (streak >= 5) decision = Math.max(0, decision - 10);
  }

  const execution = trVals.length === 0 ? 50 : wavg(trVals, RECENCY);
  const score = Math.round(
    Math.max(0, Math.min(100, decision)) * 0.4 +
    Math.max(0, Math.min(100, execution)) * 0.6,
  );

  if (score < 40) {
    return lockedResponse(
      `Discipline score ${score}/100 — cooldown required.`,
      { code: "discipline_locked", discipline_score: score },
    );
  }

  return null; // unlocked
}

// ────────────────────────────────────────────────────────────────────────────
// HANDLER
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── INTELLIGENCE-ONLY (no enforcement) ───────────────────────────────
    // Per Seneca Edge design: the analyzer is a neutral evaluator, never an
    // enforcement gate. Checklist / discipline state are surfaced as context
    // in the response, never used to block analysis. Only auth is required.
    {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const body = await req.json();
    const exec_image_url: string | undefined = body?.exec_image_url;
    const higher_image_url: string | null = body?.higher_image_url ?? null;
    // Optional second-pass: client sends back its alignment + condition so we
    // can produce hidden_observation + behavioral_insight grounded in
    // Layers 1–3 without round-tripping the chart twice.
    const insight_request = body?.insight_request ?? null;
    if (!exec_image_url || typeof exec_image_url !== "string") {
      return new Response(JSON.stringify({ error: "exec_image_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INSIGHT-ONLY MODE (second pass from client) ──────────────────────
    if (insight_request && typeof insight_request === "object") {
      const out = await generateInsight(
        insight_request.structural ?? null,
        insight_request.market_condition ?? null,
        insight_request.alignment ?? {},
      );
      return new Response(
        JSON.stringify({ status: "insight", insight: out }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STAGE 1: validation ──────────────────────────────────────────────
    const v = (await callAI(
      PRIMARY_MODEL,
      VALIDATE_SYSTEM,
      "Inspect this image. Decide if it is a real trading chart.",
      [{ url: exec_image_url, label: "exec" }],
      "validate_chart",
      VALIDATE_SCHEMA,
    )) as
      | {
          has_candles: boolean;
          has_price_axis: boolean;
          has_time_axis: boolean;
          has_chart_structure: boolean;
          confidence: number;
          reason: string;
        }
      | null;

    // Tightened gate: all axis/candle flags AND confidence ≥ 0.7.
    const isValid =
      !!v &&
      v.has_candles &&
      v.has_price_axis &&
      v.has_time_axis &&
      v.confidence >= 0.7;

    if (!isValid) {
      const details: string[] = [];
      if (!v?.has_candles) details.push("No candlestick structure detected");
      if (!v?.has_price_axis) details.push("Missing price axis");
      if (!v?.has_time_axis) details.push("Missing time axis");
      if (!v?.has_chart_structure) details.push("No visible chart structure");
      if (details.length === 0) details.push(v?.reason ?? "Not a valid chart");

      return new Response(
        JSON.stringify({
          status: "rejected",
          reason: "Invalid chart image",
          details,
          validation: v ?? null,
          // Back-compat fields the client already reads
          is_chart: false,
          confidence: v?.confidence ? Math.round(v.confidence * 100) : 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STAGE 2: feature extraction + structural analysis (parallel) ────
    const [primaryExec, structural] = await Promise.all([
      extract(PRIMARY_MODEL, EXTRACT_SYSTEM_PRIMARY, exec_image_url, "exec"),
      analyzeStructure(exec_image_url),
    ]);

    // ── STAGE 3: confidence eval ─────────────────────────────────────────
    const fallbackNeeded = needsFallback(primaryExec);
    const warnings: string[] = [];

    let finalExec: ChartExtraction | null = primaryExec;
    let modelUsed: "primary" | "fallback" = "primary";
    let fallbackExec: ChartExtraction | null = null;

    // ── STAGE 4: FALLBACK (if needed) ────────────────────────────────────
    if (fallbackNeeded) {
      try {
        fallbackExec = await extract(
          FALLBACK_MODEL,
          EXTRACT_SYSTEM_FALLBACK,
          exec_image_url,
          "exec",
        );
      } catch (err) {
        console.error("Fallback model failed:", err);
      }

      // Hard rule: once fallback is triggered, ALWAYS use fallback output
      // (unless the fallback itself failed to return anything).
      if (fallbackExec) {
        finalExec = fallbackExec;
        modelUsed = "fallback";
        warnings.push("Fallback model used");
      } else {
        warnings.push("Fallback model failed — primary result kept with low confidence");
      }
      if ((finalExec?.confidence_score ?? 0) < LOW_CONFIDENCE_THRESHOLD) {
        warnings.push("Low confidence detected");
      }
    }

    // Higher TF — single-model only (uses whichever model ended up "winning")
    let finalHigher: ChartExtraction | null = null;
    if (higher_image_url) {
      finalHigher = await extract(
        modelUsed === "fallback" ? FALLBACK_MODEL : PRIMARY_MODEL,
        modelUsed === "fallback" ? EXTRACT_SYSTEM_FALLBACK : EXTRACT_SYSTEM_PRIMARY,
        higher_image_url,
        "higher",
      );
    }

    if (!finalExec) {
      return new Response(
        JSON.stringify({
          status: "rejected",
          reason: "Analysis failed",
          details: ["Both models returned no result"],
          is_chart: true,
          confidence: Math.round((v?.confidence ?? 0) * 100),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STAGE 5: standardized output ─────────────────────────────────────
    // Map new schema → legacy `features` shape that the client + rule engine
    // already understand, so we don't break the existing flow.
    const trendMap: Record<string, "uptrend" | "downtrend" | "ranging" | "unclear"> = {
      bullish: "uptrend",
      bearish: "downtrend",
      range: "ranging",
      unknown: "unclear",
    };
    const sanitizeRegions = (rs?: ChartRegion[]) =>
      Array.isArray(rs)
        ? rs
            .filter(
              (r) =>
                r &&
                typeof r.x === "number" &&
                typeof r.y === "number" &&
                typeof r.w === "number" &&
                typeof r.h === "number" &&
                r.w > 0 &&
                r.h > 0,
            )
            .map((r) => ({
              kind: r.kind,
              label: r.label || r.kind,
              x: Math.max(0, Math.min(1, r.x)),
              y: Math.max(0, Math.min(1, r.y)),
              w: Math.max(0, Math.min(1, r.w)),
              h: Math.max(0, Math.min(1, r.h)),
            }))
        : [];

    const toLegacy = (e: ChartExtraction | null): Record<string, unknown> =>
      !e
        ? {}
        : {
            trend: trendMap[e.trend] ?? "unclear",
            structure: e.bos_detected
              ? "break_of_structure"
              : e.structure_detected
                ? "consolidation"
                : "none",
            liquidity: e.liquidity_sweep ? "both" : "none",
            volatility: "normal",
            quality: e.quality,
            candle_overlap: e.candle_overlap,
            regions: sanitizeRegions(e.regions),
          };

    return new Response(
      JSON.stringify({
        // New standardized shape
        status: "valid",
        model_used: modelUsed,
        confidence: finalExec.confidence_score,
        // Strategy-independent market interpretation (Section 2 of analyzer redesign).
        // Layer 1 — structural analysis (replaces legacy market_interpretation).
        structural,
        // Back-compat: synthesize a minimal market_interpretation from structural
        // so older clients that read it still get something useful.
        market_interpretation: structural
          ? {
              summary: structural.summary,
              market_condition:
                structural.is_pullback_or_shift === "structural_shift"
                  ? "trending"
                  : structural.momentum_strength === "weak"
                    ? "consolidating"
                    : "trending",
              directional_bias:
                structural.bos.direction === "bullish"
                  ? "bullish"
                  : structural.bos.direction === "bearish"
                    ? "bearish"
                    : "neutral",
              clarity: structural.swing_points.HH || structural.swing_points.LL ? "high" : "medium",
              key_observations: structural.key_observations ?? [],
              structure_notes: structural.bos.trigger || "",
            }
          : null,
        chart_analysis: {
          trend: finalExec.trend,
          structure_detected: finalExec.structure_detected,
          bos_detected: finalExec.bos_detected,
          liquidity_sweep: finalExec.liquidity_sweep,
          key_zone_present: finalExec.key_zone_present,
          fib_alignment: finalExec.fib_alignment,
        },
        warnings,
        validation: v,
        used_fallback: fallbackNeeded,
        primary_confidence: primaryExec?.confidence_score ?? null,
        fallback_confidence: fallbackExec?.confidence_score ?? null,

        // Back-compat fields consumed by current client + rule engine
        is_chart: true,
        confidence_pct: Math.round((v?.confidence ?? 1) * 100),
        reason: v?.reason ?? null,
        features: {
          exec: toLegacy(finalExec),
          higher: finalHigher ? toLegacy(finalHigher) : null,
        },
        ai_insight: "",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("analyze-chart error:", msg);
    const status =
      msg === "RATE_LIMITED" ? 429 : msg === "CREDITS_EXHAUSTED" ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
