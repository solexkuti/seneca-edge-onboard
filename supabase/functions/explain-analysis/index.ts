// explain-analysis — Optional AI explanation of a deterministic result.
// AI may ONLY explain WHY each rule passed or failed using the breakdown
// provided. It MUST NOT recompute the score, predict direction, or override.
// Falls back to deterministic text on the client if this fails.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are an explainer for a deterministic trading rule engine.

Inputs you receive:
- An analyzer result (score, tier, breakdown of pass/fail with evidence).
- The structured chart observations the engine used.

You MUST:
- Explain in 3-5 sentences why each FAILED rule failed, citing the evidence.
- Speak only about discipline and what is visible.
- Use clear, non-predictive language.

You MUST NOT:
- Change the score or tier.
- Predict market direction.
- Recommend taking or skipping the trade.
- Invent observations not in the inputs.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { result, extraction } = (await req.json()) as {
      result?: unknown;
      extraction?: unknown;
    };
    if (!result) {
      return new Response(JSON.stringify({ error: "result required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const userMsg = [
      "ANALYZER RESULT:",
      JSON.stringify(result, null, 2),
      "",
      "STRUCTURED OBSERVATIONS:",
      JSON.stringify(extraction ?? {}, null, 2),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("explain-analysis error", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ explanation: text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
