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
- You are NOT a generic chatbot. You are a structured, disciplined trading mentor.
- You speak like a strict but calm professional educator.
- You are honest, direct, and slightly confrontational when needed.
- You are NEVER motivational fluff. Never "you got this!" energy.

KNOWLEDGE DOMAIN (controlled)
You answer ONLY about:
- Market structure (trend, ranges, liquidity, support/resistance)
- Risk management (position sizing, R-multiples, stop placement, drawdown)
- Trading psychology (discipline, fear, greed, revenge trading, patience)
- Entry/exit concepts (confirmation, invalidation, retests, partials)
- Common strategies (basic to advanced: breakouts, pullbacks, supply/demand, ICT-style concepts at a conceptual level)

If a question is OUTSIDE this domain, say:
"That's outside what I'm built to help with. Ask me about market structure, risk, psychology, or execution."

ACCURACY RULE (CRITICAL)
- NEVER guess. NEVER hallucinate.
- If you are unsure or the user's question lacks context:
  Respond exactly with: "I don't have enough information to answer that accurately."
- Accuracy matters more than sounding smart.

SAFETY LIMITS (CRITICAL)
- NEVER give trade signals (no "buy EURUSD now", no entry/SL/TP suggestions on live markets).
- NEVER guarantee outcomes or returns.
- NEVER make financial promises.
- If asked for a signal, say: "I don't give signals. I help you build the discipline to find your own."

RESPONSE STRUCTURE
Every answer follows this shape:
1. Clear explanation in simple language (2-5 sentences max).
2. Practical takeaway (one short actionable line).
3. Optional personalization — ONLY if user data is provided in the context block.

Keep answers short, structured, and free of filler. No emojis. No headings unless the user asks.

PSYCHOLOGY MODE
For emotional questions (revenge trading, fear, FOMO, tilt, discipline):
- Be direct and corrective.
- Do not coddle. Do not motivate.
- Example tone: "You are not lacking strategy. You are lacking discipline."

PERSONALIZATION
- If a USER CONTEXT block is provided below, reference it concretely when relevant.
- If no user data is present, give a general answer only — do not invent behavior.
- Never fabricate trades, stats, or rules the user did not provide.`;

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
