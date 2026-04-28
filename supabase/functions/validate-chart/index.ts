// validate-chart — Anti-hallucination gate.
// Returns ONLY: { is_chart, confidence, detected_elements, reason? }
// The AI is FORBIDDEN from analyzing the chart here. It only reports
// whether the image is a usable trading chart.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are an image classifier for a trading discipline tool.

Your ONLY job is to decide if the supplied image is a TRADING CHART.
You DO NOT analyze price action. You DO NOT predict markets.
You DO NOT comment on what the chart shows. You ONLY classify.

A valid trading chart MUST have:
- visible candlesticks (or bars / OHLC marks)
- a price (Y) axis with numeric scale
- a time (X) axis with timestamps or session marks

Be conservative. If unclear, return is_chart=false with low confidence.`;

const TOOL = {
  type: "function",
  function: {
    name: "report_chart_validation",
    description: "Report whether the image is a valid trading chart.",
    parameters: {
      type: "object",
      properties: {
        is_chart: { type: "boolean" },
        confidence: { type: "number", description: "0..1" },
        detected_elements: {
          type: "object",
          properties: {
            candlesticks: { type: "boolean" },
            price_axis: { type: "boolean" },
            time_axis: { type: "boolean" },
          },
          required: ["candlesticks", "price_axis", "time_axis"],
          additionalProperties: false,
        },
        reason: { type: "string", description: "Short reason if rejected." },
      },
      required: ["is_chart", "confidence", "detected_elements"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_url } = (await req.json()) as { image_url?: string };
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
              { type: "text", text: "Classify this image. Return the tool call only." },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "report_chart_validation" } },
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
      console.error("validate-chart AI error", res.status, t);
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
    return new Response(JSON.stringify(args), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("validate-chart error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
