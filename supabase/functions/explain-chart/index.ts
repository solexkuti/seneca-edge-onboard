// explain-chart — produces a STRUCTURED mentor explanation for a completed
// chart analysis. Returns four required sections: summary, aligns, misaligns,
// final assessment. AI is constrained to FACTS we already computed (rule
// breakdown + extracted features) — it does not predict the market.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are a professional trading mentor.

You are given:
1. Extracted chart data (observable features only)
2. The user's strategy rules
3. The deterministic rule validation result (entry / structure / risk / timing)

Your job:
- Explain the analysis clearly and seriously
- Reference the user's strategy explicitly
- Be precise and direct

DO NOT:
- Predict the market
- Guarantee outcomes
- Use vague language
- Contradict the rule validation result you were given
- Invent data the chart features do not show

OUTPUT FORMAT (use the provided tool, all four fields are required):
1. summary — 1 to 2 sentences describing the setup and verdict
2. aligns — bullet list of what aligns with the strategy (each item ≤ 18 words)
3. misaligns — bullet list of what does NOT align (each item ≤ 18 words). If everything aligns, return [].
4. final_assessment — 1 to 2 sentences. Concise and serious.`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    aligns: { type: "array", items: { type: "string" } },
    misaligns: { type: "array", items: { type: "string" } },
    final_assessment: { type: "string" },
  },
  required: ["summary", "aligns", "misaligns", "final_assessment"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const {
      strategy_name,
      strategy_rules,
      chart_features,
      rule_breakdown,
    } = await req.json();

    if (!rule_breakdown || !chart_features) {
      return new Response(
        JSON.stringify({ error: "rule_breakdown and chart_features required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = [
      `Strategy name: ${strategy_name ?? "(unnamed)"}`,
      "",
      "Strategy rules:",
      JSON.stringify(strategy_rules ?? {}, null, 2),
      "",
      "Extracted chart features:",
      JSON.stringify(chart_features, null, 2),
      "",
      "Deterministic validation result (authoritative — do not contradict):",
      JSON.stringify(rule_breakdown, null, 2),
      "",
      "Now produce the four required sections.",
    ].join("\n");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "explain_chart",
              description: "Return the structured mentor explanation.",
              parameters: SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "explain_chart" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("explain-chart gateway error", res.status, text);
      const status = res.status === 429 ? 429 : res.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({ error: `AI gateway ${res.status}` }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: {
      summary: string;
      aligns: string[];
      misaligns: string[];
      final_assessment: string;
    } | null = null;
    if (args) {
      try {
        parsed = JSON.parse(args);
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "AI returned no structured explanation" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ explanation: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("explain-chart error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
