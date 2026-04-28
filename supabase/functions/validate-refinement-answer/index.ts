// validate-refinement-answer — strict yes/no on whether a user's answer is
// precise enough to retire a refinement question. Used by the StrategyBuilder
// refinement loop to enforce clarity.
// SAFETY: never gives trading advice; only judges precision of an answer.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You judge whether a trader's answer to a refinement question is
PRECISE ENOUGH to be enforced as a binary rule.

Accept the answer only if it is:
- Specific (numeric thresholds, candle counts, named structures, exact times)
- Binary or measurable (testable as yes/no after the fact)
- Not vague ("when it looks good", "depends", "I usually wait", "strong move")

Reject any answer that is hedged, conditional without measurable conditions,
empty, or copy-pastes the question. Never invent details — judge only the text.`;

const TOOL = {
  type: "function",
  function: {
    name: "judge_answer",
    description: "Decide if the answer is precise enough.",
    parameters: {
      type: "object",
      properties: {
        accept: { type: "boolean" },
        reason: { type: "string" },
        followup: {
          type: "string",
          description:
            "If rejected, a sharper one-line follow-up that forces specificity. Empty if accepted.",
        },
      },
      required: ["accept", "reason", "followup"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { question, answer } = await req.json();
    if (!question || typeof answer !== "string") {
      return new Response(
        JSON.stringify({ error: "question and answer required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `QUESTION: ${question}\nANSWER: ${answer}`,
            },
          ],
          tools: [TOOL],
          tool_choice: {
            type: "function",
            function: { name: "judge_answer" },
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
                ? "Rate limited. Try again shortly."
                : "AI credits exhausted.",
          }),
          {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await res.text();
      console.error("validate-refinement-answer error", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(
        JSON.stringify({
          accept: false,
          reason: "No judgement returned.",
          followup: "Be more specific — name a number, time, or pattern.",
        }),
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
    console.error("validate-refinement-answer error", err);
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
