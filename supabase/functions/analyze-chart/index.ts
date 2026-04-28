// analyze-chart
// Two-stage AI vision pipeline:
//   1) Pre-validation — is this image actually a trading chart?
//   2) Feature extraction — observable structure only (no advice).
//
// The deterministic rule check against the user's strategy happens client-side
// in src/lib/chartRuleCheck.ts using the existing rule engine. AI never decides.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ImageInput = { url: string; label: "exec" | "higher" };

async function callAI(
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
    userContent.push({
      type: "image_url",
      image_url: { url: img.url },
    });
  }

  const body = {
    model: MODEL,
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
    console.error("AI gateway error", res.status, text);
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

const VALIDATE_SYSTEM = `You are validating whether an uploaded image is a real trading chart.

Rules:
- A valid chart MUST contain candlestick patterns OR clear price bars.
- Must include price structure (highs/lows).
- Should show axes, grid, or price/time markers.
- Screenshots of trading platforms are valid.
- Random images (animals, people, objects, memes, UI screenshots that aren't charts) are INVALID.

If NOT confident, mark is_chart as false.`;

const EXTRACT_SYSTEM = `You are analyzing a trading chart. Extract ONLY observable structure from the visible price action.
Rules:
- Do NOT guess beyond visible price action.
- If unclear, set quality to "unclear" and prefer "none"/"ranging" values.
- No advice, no prediction, no entry recommendations.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exec_image_url, higher_image_url } = await req.json();
    if (!exec_image_url || typeof exec_image_url !== "string") {
      return new Response(
        JSON.stringify({ error: "exec_image_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const images: ImageInput[] = [{ url: exec_image_url, label: "exec" }];
    if (higher_image_url) images.push({ url: higher_image_url, label: "higher" });

    // ---- Stage 1: validation ----
    const validation = await callAI(
      VALIDATE_SYSTEM,
      "Inspect the image(s). Decide if this is a real trading chart.",
      [images[0]],
      "validate_chart",
      {
        type: "object",
        properties: {
          is_chart: { type: "boolean" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
        },
        required: ["is_chart", "confidence", "reason"],
        additionalProperties: false,
      },
    );

    if (!validation || !validation.is_chart || (validation.confidence as number) < 60) {
      return new Response(
        JSON.stringify({
          is_chart: false,
          confidence: validation?.confidence ?? 0,
          reason: validation?.reason ?? "This is not a valid chart.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Stage 2: feature extraction ----
    const featuresExec = await callAI(
      EXTRACT_SYSTEM,
      "Extract observable structure from this execution-timeframe chart.",
      [images[0]],
      "extract_features",
      {
        type: "object",
        properties: {
          trend: { type: "string", enum: ["uptrend", "downtrend", "ranging", "unclear"] },
          structure: {
            type: "string",
            enum: ["break_of_structure", "consolidation", "none", "unclear"],
          },
          liquidity: {
            type: "string",
            enum: ["above_highs", "below_lows", "both", "none", "unclear"],
          },
          volatility: { type: "string", enum: ["high", "normal", "low", "unclear"] },
          quality: { type: "string", enum: ["clear", "messy", "unclear"] },
        },
        required: ["trend", "structure", "liquidity", "volatility", "quality"],
        additionalProperties: false,
      },
    );

    let featuresHigher: Record<string, unknown> | null = null;
    if (higher_image_url) {
      featuresHigher = await callAI(
        EXTRACT_SYSTEM,
        "Extract observable structure from this higher-timeframe chart.",
        [{ url: higher_image_url, label: "higher" }],
        "extract_features",
        {
          type: "object",
          properties: {
            trend: { type: "string", enum: ["uptrend", "downtrend", "ranging", "unclear"] },
            structure: {
              type: "string",
              enum: ["break_of_structure", "consolidation", "none", "unclear"],
            },
            liquidity: {
              type: "string",
              enum: ["above_highs", "below_lows", "both", "none", "unclear"],
            },
            volatility: { type: "string", enum: ["high", "normal", "low", "unclear"] },
            quality: { type: "string", enum: ["clear", "messy", "unclear"] },
          },
          required: ["trend", "structure", "liquidity", "volatility", "quality"],
          additionalProperties: false,
        },
      );
    }

    // ---- Stage 3: AI explanation (general market analysis only) ----
    const explanation = await callAI(
      "You write 2-3 short factual sentences describing observable market structure on a chart. No advice. No predictions. No recommendations to enter or exit.",
      "Describe what is observable on the chart(s). Keep it neutral and factual.",
      images,
      "describe_chart",
      {
        type: "object",
        properties: {
          insight: { type: "string", maxLength: 400 },
        },
        required: ["insight"],
        additionalProperties: false,
      },
    );

    return new Response(
      JSON.stringify({
        is_chart: true,
        confidence: validation.confidence,
        reason: validation.reason,
        features: {
          exec: featuresExec ?? {},
          higher: featuresHigher ?? null,
        },
        ai_insight: (explanation?.insight as string) ?? "",
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
