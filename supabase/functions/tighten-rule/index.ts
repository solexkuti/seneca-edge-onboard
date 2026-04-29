// tighten-rule — AI fallback for vague rule rewriting.
// Given a vague rule + trigger word + surrounding strategy context,
// return 2-3 concrete, atomic, binary rewrites the user can pick from.
//
// SAFETY: never predicts markets. Never invents rules outside the user's
// stated intent. Only sharpens what the user already wrote.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You sharpen vague trading rules into precise, testable ones.

Input: a fuzzy rule the user wrote (e.g. "wait for strong rejection") plus
the trigger word that flagged it ("strong") and optional context from their
broader strategy.

Return 2-3 candidate rewrites. Each rewrite MUST be:
- Atomic — one condition only.
- Binary — testable as yes/no after the fact.
- Machine-readable — concrete numbers, candle counts, structures, or named
  patterns. No qualitative words ("good", "clean", "strong", "clear").
- Faithful — must preserve the user's intent. Never invent unrelated logic.
- Short — max 12 words, prefer 6-9.

Examples:
  "wait for strong rejection" →
    - "Rejection candle wick ≥ 60% of total range"
    - "Bearish engulfing closes below prior 3-bar low"
    - "Price rejects level twice within 5 candles"

  "enter on clean break" →
    - "Candle closes 5+ pips beyond prior structure high"
    - "Breakout candle has no upper wick > 30% of body"

If the rule is already specific enough, return an empty array.`;

const TOOL = {
  type: "function",
  function: {
    name: "emit_rewrites",
    description: "Return concrete rewrites for a vague rule.",
    parameters: {
      type: "object",
      properties: {
        rewrites: {
          type: "array",
          minItems: 0,
          maxItems: 3,
          items: { type: "string" },
        },
        reason: { type: "string" },
      },
      required: ["rewrites", "reason"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { rule, trigger, context } = await req.json();
    if (!rule || typeof rule !== "string") {
      return new Response(JSON.stringify({ error: "rule required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userMsg = [
      `VAGUE RULE: ${rule}`,
      trigger ? `FLAGGED WORD: ${trigger}` : "",
      context ? `STRATEGY CONTEXT:\n${context}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userMsg },
          ],
          tools: [TOOL],
          tool_choice: {
            type: "function",
            function: { name: "emit_rewrites" },
          },
        }),
      },
    );

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again shortly." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (res.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await res.text();
      console.error("tighten-rule AI error", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(
        JSON.stringify({ rewrites: [], reason: "no rewrites" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const args = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify(args), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tighten-rule error", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
