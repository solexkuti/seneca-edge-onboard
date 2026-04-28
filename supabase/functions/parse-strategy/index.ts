// parse-strategy — Turn raw user input into a structured rule set.
// Returns: { structured_rules, ambiguity_flags, refinement_questions }
// SAFETY: Never predicts market direction. Only extracts rules the user wrote.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are an extraction engine for a trading discipline tool.

You DO NOT predict markets. You DO NOT recommend trades. You ONLY restructure
the user's own words into a clean rule framework.

Be GENEROUS in interpretation. The user types casually — your job is to
clean it up, infer obvious gaps from context, and standardize wording.
NEVER reject input. NEVER demand precision. ALWAYS produce structured rules.

Return rules in 5 categories:
- entry: what conditions must hold to take a trade
- confirmation: secondary signals that confirm the entry
- risk: position sizing, stops, daily loss limits, drawdown rules
- behavior: psychological rules (no revenge, max trades/day, no trading after a loss)
- context: market/session/instrument filters

Each rule must be:
- A short, binary statement testable as yes/no.
- Plain language. Strip vague qualifiers ("good", "clean", "strong") and replace
  with the closest concrete equivalent you can infer. If you cannot infer,
  keep the user's word — do NOT drop the rule.
- Maximum 12 words per rule. Prefer 6-8.

Refinement questions are OPTIONAL.
- Return 0 questions when the input is clear enough to act on.
- Return AT MOST 3 questions, only when a critical concept is genuinely missing
  (no stop-loss mentioned, no entry trigger, no risk amount).
- Never ask about style, taste, or things the user could plausibly have meant.

Ambiguity flags are short notes (one line each) — never block the user, just
note what was inferred.`;

const TOOL = {
  type: "function",
  function: {
    name: "emit_blueprint",
    description: "Return the structured rules and refinement questions.",
    parameters: {
      type: "object",
      properties: {
        structured_rules: {
          type: "object",
          properties: {
            entry: { type: "array", items: { type: "string" } },
            confirmation: { type: "array", items: { type: "string" } },
            risk: { type: "array", items: { type: "string" } },
            behavior: { type: "array", items: { type: "string" } },
            context: { type: "array", items: { type: "string" } },
          },
          required: ["entry", "confirmation", "risk", "behavior", "context"],
          additionalProperties: false,
        },
        ambiguity_flags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              area: {
                type: "string",
                enum: ["entry", "confirmation", "risk", "behavior", "context", "general"],
              },
              note: { type: "string" },
            },
            required: ["area", "note"],
            additionalProperties: false,
          },
        },
        refinement_questions: {
          type: "array",
          minItems: 0,
          maxItems: 3,
          items: { type: "string" },
        },
      },
      required: ["structured_rules", "ambiguity_flags", "refinement_questions"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      rawInput,
      accountTypes,
      riskProfile,
      refinementHistory,
      tierRules,
    } = await req.json();
    if (!rawInput || typeof rawInput !== "string") {
      return new Response(JSON.stringify({ error: "rawInput is required" }), {
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

    const userBlock = [
      `ACCOUNT TYPES: ${(accountTypes ?? []).join(", ") || "unspecified"}`,
      riskProfile
        ? `RISK PROFILE: per-trade ${riskProfile.risk_per_trade_pct ?? "?"}%, daily loss ${riskProfile.daily_loss_limit_pct ?? "?"}%, max DD ${riskProfile.max_drawdown_pct ?? "?"}%`
        : "RISK PROFILE: unspecified",
      "",
      "RAW STRATEGY INPUT:",
      rawInput,
      "",
      tierRules &&
      (tierRules.a_plus || tierRules.b_plus || tierRules.c)
        ? `TIER DEFINITIONS (user-supplied):\nA+: ${tierRules.a_plus || "(none)"}\nB+: ${tierRules.b_plus || "(none)"}\nC : ${tierRules.c || "(none)"}`
        : "",
      Array.isArray(refinementHistory) && refinementHistory.length
        ? "PRIOR REFINEMENT Q&A (treat answers as authoritative):\n" +
          refinementHistory
            .map(
              (r: { question: string; answer: string }, i: number) =>
                `${i + 1}. Q: ${r.question}\n   A: ${r.answer}`,
            )
            .join("\n")
        : "",
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
            { role: "user", content: userBlock },
          ],
          tools: [TOOL],
          tool_choice: {
            type: "function",
            function: { name: "emit_blueprint" },
          },
        }),
      },
    );

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again shortly." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (res.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Add funds in Settings.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await res.text();
      console.error("parse-strategy AI error", res.status, t);
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
    console.error("parse-strategy error", err);
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
