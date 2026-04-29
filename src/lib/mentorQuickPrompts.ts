// ============================================================================
// Dynamic mentor quick prompts.
// ----------------------------------------------------------------------------
// These prompts populate the chip strip above the composer in AiMentorChat.
// They MUST feel reactive — the system is watching the user's behavior and
// surfacing the most relevant question to ask Seneca next.
//
// Rules:
//   - Always include the education prompt (no gating).
//   - Zero trades  → only education + "what to focus on first".
//   - 1–20 trades  → softer, exploratory tone.
//   - 20+ trades   → sharper, comparative tone.
//   - Pick at most 3 prompts, prioritizing the weakest metric.
//   - Rotate via a small offset so the chip set doesn't feel static across
//     re-renders for the same state.
// ============================================================================

export type QuickPrompt = {
  /** Stable id used for React keys + rotation. */
  id: string;
  /** What's rendered on the chip. */
  label: string;
  /** Full question sent to Seneca when tapped. */
  prompt: string;
  /** Higher = shown first. Drives the priority system. */
  priority: number;
};

export type QuickPromptInputs = {
  tradeCount: number;
  disciplineScore: number | null;
  winRate: number | null;   // 0..1
  avgRR: number | null;
  /** How many user messages have been sent in this session. */
  conversationCount?: number;
};

const EDUCATION: QuickPrompt = {
  id: "edu-discipline-calc",
  label: "How is discipline score calculated?",
  prompt:
    "How is my discipline score calculated? Walk me through what moves it up and what moves it down.",
  priority: 10,
};

/**
 * Trust-builder shown only on a fresh chat (zero trades + first turn).
 * Disappears permanently once the user sends any message.
 */
export const WHAT_MAKES_DIFFERENT: QuickPrompt = {
  id: "what-makes-different",
  label: "What makes Seneca different?",
  prompt: "What makes Seneca different from a normal trading journal?",
  priority: 200,
};

const ZERO_FOCUS: QuickPrompt = {
  id: "zero-focus",
  label: "What should I focus on first?",
  prompt:
    "I haven't logged any trades yet. What should I focus on first to get the most out of you?",
  priority: 50,
};

const REVIEW_LAST: QuickPrompt = {
  id: "review-last",
  label: "Review my last trade",
  prompt:
    "Look at my last trade. What did I do well, what slipped, and one thing to focus on next time?",
  priority: 40,
};

const SPOT_PATTERNS: QuickPrompt = {
  id: "spot-patterns",
  label: "Spot my patterns",
  prompt:
    "Look across my recent trades. Is there a pattern that keeps repeating? Name it plainly.",
  priority: 35,
};

/** Bucketize discipline so the question stays useful at every band. */
function disciplinePrompt(score: number, hi: boolean): QuickPrompt {
  // Lower score → higher priority (we surface weakness first).
  // 0..20 weak → 100, 20..40 → 90, 40..60 → 75, 60..80 → 55, 80..100 → 45
  const priority =
    score < 20 ? 100 :
    score < 40 ? 90 :
    score < 60 ? 75 :
    score < 80 ? 55 : 45;

  let label: string;
  let prompt: string;
  if (score < 40) {
    label = `Discipline at ${score}% — why?`;
    prompt = hi
      ? `My discipline is sitting at ${score}%. What specifically is dragging it down — be direct.`
      : `My discipline is at ${score}%. What's causing that based on what you've seen?`;
  } else if (score < 70) {
    label = `Discipline at ${score}% — what's holding it back?`;
    prompt = hi
      ? `My discipline is ${score}%. What's the ceiling I keep hitting and how do I break through it?`
      : `Discipline is ${score}%. What's holding it back from going higher?`;
  } else {
    label = `Discipline at ${score}% — how do I lock it in?`;
    prompt = `Discipline is at ${score}%. What habits should I protect to keep it there?`;
  }
  return { id: "discipline", label, prompt, priority };
}

function winRatePrompt(rate01: number, hi: boolean): QuickPrompt {
  const pct = Math.round(rate01 * 100);
  // Lower win rate → higher priority, but capped below the discipline weak band.
  const priority =
    pct < 30 ? 95 :
    pct < 45 ? 80 :
    pct < 60 ? 60 : 50;
  const label = `Why is my win rate ${pct}%?`;
  const prompt = hi
    ? `My win rate is ${pct}% across the recent window. Compare what's working vs what's losing — be specific.`
    : `My win rate is ${pct}% so far. What does that tell you about how I'm trading?`;
  return { id: "win-rate", label, prompt, priority };
}

function rrPrompt(rr: number, hi: boolean): QuickPrompt {
  const display = rr.toFixed(1);
  // Lower RR → higher priority.
  const priority =
    rr < 0.5 ? 92 :
    rr < 1   ? 78 :
    rr < 1.5 ? 58 : 48;
  const label = `My RR is ${display} — how do I improve it?`;
  const prompt = hi
    ? `My average RR is ${display}. Look at my exits and entries — where am I leaving R on the table?`
    : `My average RR is ${display}. How do I push that higher without forcing trades?`;
  return { id: "avg-rr", label, prompt, priority };
}

/**
 * Build the rotated, prioritized chip set.
 *
 * @param rotation — a small integer (e.g. minute / session counter) that
 *                   nudges which prompts surface when several share priority.
 *                   Pass `0` for fully deterministic order.
 */
export function buildQuickPrompts(
  inputs: QuickPromptInputs,
  rotation = 0,
): QuickPrompt[] {
  const { tradeCount, disciplineScore, winRate, avgRR, conversationCount = 0 } = inputs;

  // -------- Zero data: education-only set --------
  if (tradeCount === 0) {
    // Trust-builder appears only on the very first turn (no user msgs yet,
    // or a single one — covers the intro-only state).
    if (conversationCount <= 1) {
      return [WHAT_MAKES_DIFFERENT, ZERO_FOCUS, EDUCATION];
    }
    return [ZERO_FOCUS, EDUCATION];
  }

  const hi = tradeCount >= 20;
  // Spec: removed duplicate "Review my last trade" / "Review my trades".
  // Core staples: pattern spotting + education.
  const candidates: QuickPrompt[] = [SPOT_PATTERNS, EDUCATION];
  // Silence unused-import warning — REVIEW_LAST kept for potential future use.
  void REVIEW_LAST;

  if (typeof disciplineScore === "number") {
    candidates.push(disciplinePrompt(disciplineScore, hi));
  }
  if (typeof winRate === "number") {
    candidates.push(winRatePrompt(winRate, hi));
  }
  if (typeof avgRR === "number") {
    candidates.push(rrPrompt(avgRR, hi));
  }

  // Sort by priority desc; ties broken by id for stability.
  candidates.sort((a, b) =>
    b.priority - a.priority || a.id.localeCompare(b.id),
  );

  // Always keep the top item (highest-priority weakness or staple).
  // Then rotate through the rest so the strip doesn't feel frozen.
  const [head, ...tail] = candidates;
  const offset = tail.length > 0 ? Math.abs(rotation) % tail.length : 0;
  const rotated = tail.slice(offset).concat(tail.slice(0, offset));

  // Cap at 3 chips (head + 2 rotated). Dedupe by id just in case.
  const out: QuickPrompt[] = [];
  for (const c of [head, ...rotated]) {
    if (!c) continue;
    if (out.find((x) => x.id === c.id)) continue;
    out.push(c);
    if (out.length >= 3) break;
  }
  return out;
}
