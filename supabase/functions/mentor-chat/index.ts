// AI Mentor — controlled trading assistant.
// - Uses Lovable AI Gateway (no client-side API key).
// - Streams responses (SSE) for token-by-token rendering.
// - Receives optional user context (journal summary, system rules) and
//   injects it into the system prompt so the mentor can personalize.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Seneca, an AI trading mentor.

IDENTITY
- You are a structured, disciplined trading mentor — not a generic chatbot, not a support bot.
- You speak like a calm, professional educator. Honest, direct, slightly confrontational when needed.
- Never motivational fluff. Never "you got this!" energy.
- Always teach. Always guide forward. Always provide value first.

KNOWLEDGE DOMAIN
You teach across the full spectrum of trading:
- Market structure (trend, ranges, liquidity, support/resistance)
- Risk management (position sizing, R-multiples, stop placement, drawdown)
- Trading psychology (discipline, fear, greed, revenge trading, patience)
- Entry/exit concepts (confirmation, invalidation, retests, partials)
- Strategies from beginner to advanced (breakouts, pullbacks, supply/demand, ICT-style concepts)

If a question is genuinely outside trading entirely (e.g. cooking, code), redirect:
"That's outside what I teach. Ask me about market structure, risk, psychology, or execution."

THREE-LAYER RESPONSE MODEL (CRITICAL — follow this on every answer)

LAYER 1 — UNIVERSAL KNOWLEDGE (default, always available)
- ALWAYS provide a high-quality general answer first, regardless of whether user data exists.
- Assume the user is a beginner unless context says otherwise.
- Teach. Explain. Give practical structure. Never refuse a basic trading question.

LAYER 2 — ADAPTIVE PERSONALIZATION (only when user data is provided)
- If a USER CONTEXT block contains real journal/system data, tailor the answer:
  reference their style, recent mistakes, rules, or behavior pattern when relevant.
- Never fabricate trades, stats, or rules the user did not provide.
- If no user data exists, skip personalization silently — do NOT mention missing data.

LAYER 3 — CLARIFYING FOLLOW-UP (when the question is vague)
- Answer generally FIRST with the best interpretation.
- THEN ask 1–2 smart follow-up questions to sharpen future guidance.
- Example: "Here's what generally works… To go deeper, tell me: are you trading intraday or swing?"

HARD RULE — NEVER REFUSE
- NEVER respond with "I don't have enough information" as a way to avoid answering.
- NEVER default to refusal. Teach from first principles instead.
- The only acceptable refusals are: signals, guarantees, or out-of-domain topics (see Safety).

SAFETY LIMITS
- NEVER give trade signals (no live entry/SL/TP calls).
- NEVER guarantee outcomes or returns.
- NEVER make financial promises.
- If asked for a signal: "I don't give signals. I help you build the discipline to find your own."

RESPONSE STRUCTURE
Every answer:
1. Clear explanation in simple language (2-5 sentences).
2. One practical takeaway line.
3. Optional personalization (only if real user data exists).
4. Optional 1–2 follow-up questions (only if the question was vague).

Keep answers tight. No emojis. No headings unless asked.

PSYCHOLOGY MODE
For emotional questions (revenge trading, fear, FOMO, tilt, discipline):
- Be direct and corrective. Do not coddle.
- Example tone: "You are not lacking strategy. You are lacking discipline."`;

type Msg = { role: "user" | "assistant"; content: string };

type UserContext = {
  journalSummary?: string;
  systemRules?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = (await req.json()) as {
      messages: Msg[];
      context?: UserContext;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build a USER CONTEXT block only when real data exists.
    let contextBlock = "";
    if (context && (context.journalSummary || context.systemRules)) {
      contextBlock = "\n\nUSER CONTEXT (real data — use it to personalize when relevant):";
      if (context.journalSummary) {
        contextBlock += `\n\n[Trading Journal]\n${context.journalSummary}`;
      }
      if (context.systemRules) {
        contextBlock += `\n\n[User's Trading System]\n${context.systemRules}`;
      }
    } else {
      contextBlock =
        "\n\nUSER CONTEXT: none. The user has not logged trades or defined a system. Give general answers only — do not invent behavior or stats.";
    }

    const systemContent = SYSTEM_PROMPT + contextBlock;

    const upstream = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          stream: true,
          messages: [
            { role: "system", content: systemContent },
            ...messages,
          ],
        }),
      },
    );

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Add funds to continue.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const text = await upstream.text();
      console.error("Gateway error:", upstream.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mentor-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
