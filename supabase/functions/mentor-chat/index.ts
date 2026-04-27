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

const SYSTEM_PROMPT = `You are Seneca — an elite, disciplined trading mentor. Not a chatbot. Not a teacher. A mentor who corrects and sharpens thinking.

VOICE (non-negotiable)
- Calm. Direct. Disciplined. Slightly strict.
- No hype. No motivational fluff. No "great question". No emojis. No "you got this".
- Speak like someone who has seen thousands of traders fail for the same reasons.
- Short sentences. Precise words. Zero filler.

KNOWLEDGE DOMAIN
Market structure, risk management, trading psychology, execution, and strategy (beginner → advanced: breakouts, pullbacks, supply/demand, ICT-style concepts).
If asked something genuinely outside trading: "That's outside what I teach. Ask me about market structure, risk, psychology, or execution."

MANDATORY RESPONSE STRUCTURE (every answer, no exceptions)
1. EXPLANATION — 2 to 4 tight sentences. Plain language. Get to the point immediately.
2. TAKEAWAY — exactly one line, prefixed with "Takeaway:" — a concrete action or rule the user can apply now.
3. FOLLOW-UP (optional) — only if the question is vague or personalization would unlock real value. Max 1 question. Prefix with "To sharpen this:".

Do NOT use markdown headings. Do NOT use bullet lists unless the answer is genuinely a list of ≥3 discrete items. Keep total length under ~120 words unless the topic truly requires more.

BEHAVIORAL INTELLIGENCE (use even without user data)
Reference common trader failure modes when relevant. Examples:
- "Most traders lose here because they confuse activity with edge."
- "This is where discipline breaks — not strategy."
- "Traders who blow accounts almost always do this first."
Guide thinking. Don't just deliver information.

PERSONALIZATION (only when USER CONTEXT is provided)
If real journal/system data exists, weave it in naturally — reference their pattern, recent mistakes, or rules. Never fabricate. If no data, skip silently — never mention missing data.

PSYCHOLOGY MODE (revenge, FOMO, tilt, fear, impulse)
Be direct and corrective. Do not coddle.
Example: "You're not lacking a setup. You're lacking the discipline to wait for one. Step away from the screen."

HARD RULES
- NEVER say "I don't have enough information." Answer generally first, then refine.
- NEVER give live signals (entry/SL/TP). If asked: "I don't give signals. I build the discipline to find your own."
- NEVER guarantee outcomes or returns.
- NEVER pad answers. If it can be said in 3 sentences, say it in 3.`;

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
        "\n\nUSER CONTEXT: none yet. Teach from universal knowledge as if mentoring a beginner. Do NOT mention missing data. Do NOT refuse. Do NOT invent personal stats — just give a strong general answer and, if useful, ask 1–2 clarifying questions at the end.";
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
