// Mentor conversation state machine.
//
// Seneca is a behavioral mentor, not a stateless chatbot. When she surfaces
// a pattern + question (e.g. "Want to dig into it?"), the next user reply
// MUST be interpreted in that context — never re-routed to general chat.
//
// This module is pure: it detects intent, picks the right deep-dive script,
// and returns the next message + UI chips. The AiMentorChat component owns
// the state and renders accordingly.

export type MentorMode = "idle" | "pattern_detected" | "deep_dive" | "reflection";

export type ConversationState = {
  mode: MentorMode;
  /** Stable id of the active pattern (e.g. "risk_rule", "fomo", "generic"). */
  active_pattern: string | null;
  /** Last guided question Seneca asked, verbatim. Null in idle. */
  last_question: string | null;
  /** Step index inside the active deep-dive script. */
  step: number;
};

export const INITIAL_STATE: ConversationState = {
  mode: "idle",
  active_pattern: null,
  last_question: null,
  step: 0,
};

// ── Intent classification ────────────────────────────────────────────

/** True when text is an unambiguous "yes" reply. */
export function isYes(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /^(y|ya|ye|yes|yeah|yep|yup|sure|ok|okay|k|please|do it|go|let'?s go|break it down|dig in|alright)\b/.test(
    t,
  );
}

/** True when text is an unambiguous "no" reply. */
export function isNo(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /^(n|no|nope|nah|not now|skip|later|pass|stop)\b/.test(t);
}

// ── Pattern detection from intro/recent assistant text ───────────────

/**
 * Inspect the most recent guided assistant message and figure out which
 * pattern script applies. Returns a `pattern_id` keyed into DEEP_DIVES.
 */
export function detectPattern(text: string): string {
  const t = text.toLowerCase();
  if (/risk\s*(rule|management|sizing|%)/.test(t)) return "risk_rule";
  if (/fomo|chas(ed|ing)|overtrad/.test(t)) return "fomo";
  if (/(without\s+(confirmation|setup)|no\s+confirmation|too\s+early)/.test(t))
    return "no_confirmation";
  if (/revenge/.test(t)) return "revenge";
  if (/exit|stop\s*loss|cut\s+winner|move(d)?\s+stop/.test(t)) return "exit_discipline";
  return "generic";
}

/**
 * Returns true when the assistant message ends with a guided yes/no
 * question that should keep the conversation in pattern_detected mode.
 */
export function isGuidedQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t.endsWith("?")) return false;
  return (
    /\b(want|shall|should)\b/.test(t) ||
    /\bbreak\s+it\s+down\b/.test(t) ||
    /\bdig\s+(in|into)\b/.test(t) ||
    /\blook\s+at\s+it\b/.test(t) ||
    /\bcloser\s+look\b/.test(t) ||
    /\block\s+in\b/.test(t)
  );
}

// ── Deep-dive scripts ────────────────────────────────────────────────

export type DeepDiveOption = {
  id: string;
  label: string;
  /** Reply Seneca delivers when this option is picked. */
  response: string;
};

export type DeepDiveScript = {
  /** Step 1 — name the pattern back to the user. */
  identify: string;
  /** Step 2 — force awareness, ask the open question. */
  awareness: string;
  /** Step 3 — structured options. */
  options: DeepDiveOption[];
};

const DEEP_DIVES: Record<string, DeepDiveScript> = {
  risk_rule: {
    identify: "You've broken your risk rule 3 times recently.",
    awareness:
      "Let's slow this down. What happened in those moments?\n\nPick the one that fits — even if it's uncomfortable.",
    options: [
      {
        id: "size_up",
        label: "I increased lot size",
        response:
          "That's not strategy. That's emotion borrowing your account.\n\nThe rule exists for the worst version of you, not the best. Next trade, write the size on paper before you click. If you need to talk yourself into it, it's already too big.",
      },
      {
        id: "ignored_stop",
        label: "I didn't respect my stop",
        response:
          "Stops aren't suggestions. The moment you negotiate with one, you're trading hope, not your edge.\n\nNext trade: stop goes in WITH the entry, not after. If you can't accept the loss before clicking, the trade isn't valid.",
      },
      {
        id: "felt_confident",
        label: "I felt confident and ignored risk",
        response:
          "That's not confidence. That's loss of control disguised as certainty.\n\nReal confidence still respects the rule. Confidence without limits is the precursor to your worst trade.",
      },
      {
        id: "dont_know",
        label: "I don't know",
        response:
          "That's an honest answer. \"I don't know\" is where awareness starts.\n\nFor the next 3 trades, write one sentence before each entry: \"Why is this risk size right?\" If you can't answer it cleanly, don't take the trade.",
      },
    ],
  },
  fomo: {
    identify: "FOMO has shown up in your last few trades.",
    awareness:
      "Let's name it. What pulled you in?",
    options: [
      {
        id: "fast_move",
        label: "Price was moving fast",
        response:
          "Fast moves aren't your edge. They're someone else's exit.\n\nYour rule: if you didn't see the setup forming, the move isn't yours. Next time price runs without you — sit on your hands.",
      },
      {
        id: "missed_one",
        label: "I missed one and chased the next",
        response:
          "Missed trades are not lost trades. The chase is where real losses come from.\n\nThe market gives 100 setups a week. You only need the ones that fit your plan.",
      },
      {
        id: "fear_missing_day",
        label: "I didn't want a flat day",
        response:
          "Flat days aren't failures. Forced trades are.\n\nNo trade is a position. Protect that position the same way you protect a winner.",
      },
      {
        id: "dont_know",
        label: "I don't know",
        response:
          "Then we slow it down. Before the next entry, ask: \"Did I plan this, or did I notice it?\"\n\nNoticed trades are FOMO. Planned trades are edge.",
      },
    ],
  },
  no_confirmation: {
    identify: "You've been entering without full confirmation.",
    awareness: "What made you click before the setup completed?",
    options: [
      {
        id: "afraid_miss",
        label: "Afraid I'd miss the move",
        response:
          "Anticipation is not analysis. Setups that need you to predict aren't your edge — they're a guess wearing a chart.",
      },
      {
        id: "looked_obvious",
        label: "It looked obvious",
        response:
          "Obvious to you isn't the same as confirmed. Your plan exists precisely so you don't trade on \"obvious.\"",
      },
      {
        id: "tired_waiting",
        label: "Tired of waiting",
        response:
          "Patience is the position. The trade you take out of boredom is rarely the trade you'd take with discipline.",
      },
      {
        id: "dont_know",
        label: "I don't know",
        response:
          "Next time, write the missing confirmation in your journal BEFORE you click. If the box is empty, you don't have a trade — you have an urge.",
      },
    ],
  },
  revenge: {
    identify: "These trades look like revenge — entries clustered after a loss.",
    awareness: "What were you trying to win back?",
    options: [
      {
        id: "the_money",
        label: "The money I just lost",
        response:
          "The market doesn't owe you the loss back. Revenge trades pay it forward — to someone with more discipline than you had in that moment.",
      },
      {
        id: "the_feeling",
        label: "How I felt after the loss",
        response:
          "Trading to fix a feeling is not trading. It's emotional self-medication using your account.",
      },
      {
        id: "prove_something",
        label: "I wanted to prove I was right",
        response:
          "The market doesn't care if you're right. It only pays for execution. Being right and undisciplined still loses money.",
      },
      {
        id: "dont_know",
        label: "I don't know",
        response:
          "Then add a rule: after a loss, no entry for 30 minutes. The cost of waiting is nothing. The cost of revenge compounds.",
      },
    ],
  },
  exit_discipline: {
    identify: "Your exits keep slipping — moved stops or cut winners.",
    awareness: "What's pulling you out (or holding you in) too early?",
    options: [
      {
        id: "panic",
        label: "Panic when price came back",
        response:
          "Pullbacks aren't reversals. If the structure didn't break, the trade isn't broken either. Stick with the plan, not the candle.",
      },
      {
        id: "greed",
        label: "Hoping for more",
        response:
          "Targets exist for a reason. \"More\" without a plan is gambling on your own discipline holding under pressure.",
      },
      {
        id: "moved_stop",
        label: "I moved my stop",
        response:
          "A moved stop is a removed stop. The first version of the trade was your real plan — everything after is improvisation.",
      },
      {
        id: "dont_know",
        label: "I don't know",
        response:
          "Set the exit BEFORE the trade and don't touch it. The act of touching it is the breakdown.",
      },
    ],
  },
  generic: {
    identify: "Something is repeating across your last trades.",
    awareness: "Let's name what's happening. Which one feels closest?",
    options: [
      {
        id: "size",
        label: "I'm sizing up at the wrong time",
        response:
          "Sizing decisions made under pressure are almost always wrong. Size is decided before the trade, not during it.",
      },
      {
        id: "exit",
        label: "I'm not respecting my exits",
        response:
          "Exits are where the trade is actually won. The entry is the easy part. Tighten this and your numbers change.",
      },
      {
        id: "patience",
        label: "I'm forcing trades",
        response:
          "Forced trades are the cost of impatience. The market pays for selectivity — not activity.",
      },
      {
        id: "dont_know",
        label: "I don't know",
        response:
          "That's fine. Awareness comes first. For the next 3 trades, write one sentence after each: \"What did I break?\" The pattern will name itself.",
      },
    ],
  },
};

export function getScript(patternId: string | null): DeepDiveScript {
  if (!patternId) return DEEP_DIVES.generic;
  return DEEP_DIVES[patternId] ?? DEEP_DIVES.generic;
}

/** Closing line after an option is picked — keeps the door open without forcing chat. */
export const DEEP_DIVE_CLOSING =
  "Sit with that one. When you're ready, ask me anything.";
