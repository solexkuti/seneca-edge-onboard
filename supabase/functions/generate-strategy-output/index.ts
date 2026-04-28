// generate-strategy-output — turn structured rules into:
//  - a tier-stratified binary checklist (A+ perfect, B+ 1 tolerance, C minimum)
//  - a clean trading-plan prose document
// SAFETY: never predicts direction; only restates user-defined rules.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You convert a trader's structured rules into:
1) A binary checklist split into three tiers — every item MUST be answerable yes/no.
   - A+ : every rule must be true (the perfect setup).
   - B+ : allows at most 1 non-critical rule to be missed.
   - C  : the minimum acceptable setup — only the critical rules.
   Critical rules are anything in 'risk' and explicit hard 'behavior' rules.
2) A clean trading plan in plain language, organized into sections:
   Account & Risk, Context, Entry, Confirmation, Exit & Risk, Behavior.

NEVER invent rules. NEVER predict market direction. NEVER add advice the user didn't write.
If a category is empty, skip it cleanly rather than padding.`;

const TOOL = {
  type: "function",
  function: {
    name: "emit_outputs",
    description: "Return the tier checklist and trading plan.",
    parameters: {
      type: "object",
      properties: {
        checklist: {
          type: "object",
          properties: {
            a_plus: { type: "array", items: { type: "string" } },
            b_plus: { type: "array", items: { type: "string" } },
            c: { type: "array", items: { type: "string" } },
          },
          required: ["a_plus", "b_plus", "c"],
          additionalProperties: false,
        },
        trading_plan: { type: "string" },
      },
      required: ["checklist", "trading_plan"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { name, accountTypes, riskProfile, structuredRules, tierStrictness } =
      await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const ruleBlock = JSON.stringify(structuredRules ?? {}, null, 2);
    const userBlock = `STRATEGY: ${name ?? "Untitled"}
ACCOUNT TYPES: ${(accountTypes ?? []).join(", ") || "unspecified"}
RISK PROFILE: per-trade ${riskProfile?.risk_per_trade_pct ?? "?"}%, daily loss ${riskProfile?.daily_loss_limit_pct ?? "?"}%, max DD ${riskProfile?.max_drawdown_pct ?? "?"}%
TIER STRICTNESS: A+=${tierStrictness?.a_plus ?? 100} B+=${tierStrictness?.b_plus ?? 80} C=${tierStrictness?.c ?? 60}

STRUCTURED RULES (JSON):
${ruleBlock}`;

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
            { role: "user", content: userBlock },
          ],
          tools: [TOOL],
          tool_choice: {
            type: "function",
            function: { name: "emit_outputs" },
          },
        }),
      },
    );

    if (!res.ok) {
      if (res.status === 429 || res.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              res.status === 429
                ? "Rate limited. Please try again shortly."
                : "AI credits exhausted. Add funds in Settings.",
          }),
          {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await res.text();
      console.error("generate-strategy-output error", res.status, t);
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
    console.error("generate-strategy-output error", err);
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
