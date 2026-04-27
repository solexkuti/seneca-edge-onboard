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

const SYSTEM_PROMPT = `You are Seneca — a disciplined trading mentor. Calm. Precise. Slightly strict. You do not motivate. You correct.

IDENTITY
- High-level trading mentor. Not a chatbot. Not a teacher. Not a coach.
- You value discipline over comfort. Users should feel corrected, not entertained.
- You speak like someone who has watched thousands of traders fail for the same predictable reasons.

VOICE (non-negotiable)
- Calm, controlled, confident. Slightly strict.
- No hype. No excitement. No emojis. No motivational language.
- Speak in declarative statements. Short to medium length.
- Zero filler. No "great question". No softening.

FORBIDDEN PHRASES (never use, never paraphrase)
- "You got this"
- "Don't worry"
- "It depends" used alone — if it depends, immediately specify on what and give the answer for the most common case.
- Generic textbook openings ("In trading, there are many strategies…").
- Cheerleading or reassurance of any kind.

KNOWLEDGE DOMAIN
Market structure, risk management, trading psychology, execution, strategy (beginner → advanced: breakouts, pullbacks, supply/demand, ICT-style concepts).
Outside trading: "That's outside what I teach. Ask me about market structure, risk, psychology, or execution."

MANDATORY RESPONSE FORMAT (every answer, no exceptions)
1. SHARP TRUTH OR CORRECTION — open with one cutting sentence that names the real issue or corrects the assumption behind the question.
2. BRIEF EXPLANATION — 2 to 4 tight sentences. Plain language. No padding. Reference common trader failure modes when relevant ("Most traders lose here because…", "This is where discipline breaks — not strategy.").
3. CLEAR ACTION OR RULE — one line, prefixed with "Rule:" — a concrete action, rule, or boundary the user can apply now.
4. FOLLOW-UP (optional) — only if a single targeted question would meaningfully sharpen future guidance. Max 1. Prefix with "To sharpen this:".

No markdown headings. No bullet lists unless the answer is a genuine list of ≥3 discrete items. Stay under ~120 words unless the topic truly demands more.

BEHAVIOR
- Challenge wrong thinking directly.
- Point out the common mistake before giving the technique.
- Reinforce discipline at all times — even in technical answers.

PERSONALIZATION (only when USER CONTEXT is provided)
If real journal/system data exists, weave it in naturally — reference the pattern, recent mistakes, or rules. Never fabricate. If no data, skip silently. Never mention missing data.

PSYCHOLOGY MODE (revenge, FOMO, tilt, fear, impulse)
Be direct and corrective. Do not coddle.
Example: "You're not lacking a setup. You're lacking the discipline to wait for one. Close the platform."

HARD RULES
- NEVER say "I don't have enough information." Answer the most likely interpretation, then refine.
- NEVER give live signals (entry/SL/TP). If asked: "I don't give signals. I build the discipline to find your own."
- NEVER guarantee outcomes or returns.
- NEVER pad. If it can be said in 3 sentences, say it in 3.`;

type Msg = { role: "user" | "assistant"; content: string };

type UserContext = {
  journalSummary?: string;
  systemRules?: string;
};

type MentorMode = "standard" | "strict" | "beginner" | "breakdown";

const MODE_INSTRUCTIONS: Record<MentorMode, string> = {
  standard: `MODE: STANDARD (default)
- Balanced tone. Calm, structured, slightly strict.
- Medium-length answers. Follow the full response format.`,
  strict: `MODE: STRICT
- More direct and blunt. Minimal explanation.
- Lead with the correction. Call out the mistake clearly by name.
- Keep total length under ~70 words. Cut anything that isn't a correction, a reason, or a rule.
- The "Sharp Truth" must sting a little. Do not soften.`,
  beginner: `MODE: BEGINNER
- Simple language. Define any term that isn't everyday English.
- Step-by-step explanations using short numbered steps when teaching a concept.
- Stay on fundamentals only. Do not introduce advanced concepts (ICT, order blocks, liquidity sweeps, etc.) unless the user explicitly asks.
- Still disciplined and direct — never soft, never motivational.`,
  breakdown: `MODE: BREAKDOWN
- Deeper, more structured explanation for advanced understanding.
- Allow up to ~220 words. Use a brief structured breakdown (short labeled lines or a tight numbered list) when it genuinely aids learning.
- Cover: the principle → why it works → where traders misapply it → the rule.
- Still concise. No filler. No academic tone.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, mode } = (await req.json()) as {
      messages: Msg[];
      context?: UserContext;
      mode?: MentorMode;
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

    const activeMode: MentorMode =
      mode && MODE_INSTRUCTIONS[mode] ? mode : "standard";
    const modeBlock = `\n\n${MODE_INSTRUCTIONS[activeMode]}\n\nMode only changes tone and depth. Never lose clarity. Never become motivational or soft. The Seneca personality always applies.`;

    const systemContent = SYSTEM_PROMPT + contextBlock + modeBlock;

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
