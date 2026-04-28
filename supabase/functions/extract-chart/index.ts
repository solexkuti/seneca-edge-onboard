// extract-chart — Structured observation extraction.
// Returns ONLY a StructuredExtraction JSON object via tool calling.
// The AI MUST NOT predict, recommend, or interpret. Observation only.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a CHART OBSERVATION extractor for a trading discipline tool.

Your job is to look at a trading chart and report ONLY the factual observations
listed in the tool schema. You DO NOT:
- predict market direction
- recommend any trade
- comment on whether a setup is good or bad
- guess values you can't see

If something is not clearly visible, return false / null. Be conservative.

For trend, use "bullish" if higher highs and higher lows are visible, "bearish"
if lower highs and lower lows, otherwise "range".

For fibonacci_detected, only true if a fib retracement tool is visibly drawn on
the chart. Do not infer fibs from price action alone. fib_zone, when present,
is the [low, high] retracement levels visible (e.g. [0.618, 0.79]).

For key_levels, list visibly drawn horizontal price levels (numeric prices).
Empty array if none drawn.

Use the notes field for ONE short factual sentence per observation that is true.
Notes must describe what is visible, not what it means.`;

const TOOL = {
  type: "function",
  function: {
    name: "report_extraction",
    description: "Report structured chart observations only.",
    parameters: {
      type: "object",
      properties: {
        structure: {
          type: "object",
          properties: {
            trend: { type: "string", enum: ["bullish", "bearish", "range"] },
            break_of_structure: { type: "boolean" },
            liquidity_sweep: { type: "boolean" },
          },
          required: ["trend", "break_of_structure", "liquidity_sweep"],
          additionalProperties: false,
        },
        levels: {
          type: "object",
          properties: {
            fibonacci_detected: { type: "boolean" },
            fib_zone: {
              type: "array",
              items: { type: "number" },
              description: "[low, high] visible fib retracement levels, or omit if none.",
            },
            key_levels: { type: "array", items: { type: "number" } },
          },
          required: ["fibonacci_detected", "key_levels"],
          additionalProperties: false,
        },
        price_action: {
          type: "object",
          properties: {
            rejection: { type: "boolean" },
            engulfing: { type: "boolean" },
            consolidation: { type: "boolean" },
          },
          required: ["rejection", "engulfing", "consolidation"],
          additionalProperties: false,
        },
        notes: {
          type: "object",
          properties: {
            trend: { type: "string" },
            break_of_structure: { type: "string" },
            liquidity_sweep: { type: "string" },
            fibonacci_detected: { type: "string" },
            rejection: { type: "string" },
            engulfing: { type: "string" },
            consolidation: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["structure", "levels", "price_action"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_url, timeframe_label } = (await req.json()) as {
      image_url?: string;
      timeframe_label?: string;
    };
    if (!image_url || typeof image_url !== "string") {
      return new Response(JSON.stringify({ error: "image_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract observations from this ${timeframe_label ?? ""} chart. Return the tool call only.`,
              },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "report_extraction" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429)
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (res.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      const t = await res.text();
      console.error("extract-chart AI error", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "No tool call returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(call.function.arguments);
    // Normalise: ensure key_levels exists, fib_zone may be missing.
    if (!Array.isArray(args.levels?.key_levels)) args.levels.key_levels = [];
    if (args.levels?.fib_zone && args.levels.fib_zone.length !== 2) args.levels.fib_zone = null;
    return new Response(JSON.stringify(args), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-chart error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
