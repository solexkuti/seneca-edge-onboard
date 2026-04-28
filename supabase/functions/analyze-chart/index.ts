// analyze-chart — strict multi-layer pipeline
//   1) Image validation (block non-charts)
//   2) Primary model: google/gemini-2.5-flash → structured extraction
//   3) Confidence evaluation
//   4) Fallback model: openai/gpt-5-mini (only if needed)
//   5) Standardized output
//
// Hard rules: never analyze non-charts, never return low-confidence primary
// when fallback was triggered, never invent structure when none detected.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "openai/gpt-5-mini";
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
- Do NOT predict or recommend.
- If anything is unclear, lower confidence_score.
- If no structure is visible, set structure_detected=false and trend="range".
- confidence_score reflects how clearly the chart supports your answer (0–1).`;

const EXTRACT_SYSTEM_FALLBACK = `You are a STRICT, CAUTIOUS chart analyst acting as a second opinion.
The first model produced low-confidence output. Be conservative:
- Default to trend="range" and structure_detected=false unless clearly visible.
- Set confidence_score honestly — do not inflate it.
- Never invent BOS, sweeps, or zones that are not clearly on the chart.`;

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
    confidence_score: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "trend",
    "structure_detected",
    "bos_detected",
    "liquidity_sweep",
    "key_zone_present",
    "fib_alignment",
    "quality",
    "confidence_score",
  ],
  additionalProperties: false,
};

type ChartExtraction = {
  trend: "bullish" | "bearish" | "range" | "unknown";
  structure_detected: boolean;
  bos_detected: boolean;
  liquidity_sweep: boolean;
  key_zone_present: boolean;
  fib_alignment: boolean;
  quality: "clear" | "messy" | "unclear";
  confidence_score: number;
};

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
// HANDLER
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exec_image_url, higher_image_url } = await req.json();
    if (!exec_image_url || typeof exec_image_url !== "string") {
      return new Response(JSON.stringify({ error: "exec_image_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const isValid =
      !!v &&
      v.has_candles &&
      v.has_price_axis &&
      v.has_time_axis &&
      v.confidence >= 0.6;

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

    // ── STAGE 2: PRIMARY extraction ──────────────────────────────────────
    const primaryExec = await extract(
      PRIMARY_MODEL,
      EXTRACT_SYSTEM_PRIMARY,
      exec_image_url,
      "exec",
    );

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
    const toLegacy = (e: ChartExtraction | null) =>
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
          };

    return new Response(
      JSON.stringify({
        // New standardized shape
        status: "valid",
        model_used: modelUsed,
        confidence: finalExec.confidence_score,
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
