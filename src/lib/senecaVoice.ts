// Seneca's voice — single source of mentor copy.
//
// Every module imports lines from here so tone is identical across
// Onboarding, Strategy Builder, Chart Analyzer, Daily Checklist, Journal,
// Mentor, and Dashboard.
//
// Tone rules (do not violate):
//   - Calm, direct, authoritative, minimal.
//   - No exclamation marks. No emoji except the rare ✓ confirmation.
//   - Never say "AI", "processing", "error", "invalid input", "failed".
//   - Speak as one person guiding the trader, not a system reporting status.
//
// If a new line is needed, add it here. Do NOT inline mentor copy in components.

export const SenecaVoice = {
  // ---------- Acknowledgements ----------
  noted: "Noted.",
  refining: "I'll refine this.",
  refined: "Refined ✓",
  saved: "Saved.",
  willFill: "I'll fill this based on your strategy.",

  // ---------- Loading / thinking ----------
  thinking: "Thinking…",
  structuring: "Structuring your logic…",
  preparing: "Preparing your file…",
  reading: "Reading your chart…",
  reviewing: "Reviewing your day…",

  // ---------- Block messages (replace generic errors) ----------
  blocks: {
    noStrategy: "Build your strategy first. I need your rules.",
    notConfirmed: "Confirm your rules before you trade.",
    disciplineLocked: "Step back. We reset before the next trade.",
    inRecovery: "Finish recovery. Then we continue.",
  },

  // ---------- Verdicts (Chart Analyzer, Trade Check) ----------
  verdict: {
    valid: "This fits your system.",
    weak: "Borderline. Consider passing.",
    invalid: "This is not your setup.",
  },

  // ---------- Daily checklist ----------
  checklist: {
    intro: "Confirm your rules. Then you trade.",
    confirmed: "Locked in. Trade your plan.",
  },

  // ---------- Journal ----------
  journal: {
    intro: "Tell me what happened. I'll find the pattern.",
    logged: "Logged. I'll watch for the pattern.",
  },

  // ---------- Onboarding (training sequence — short, sharp) ----------
  onboarding: {
    open: "Let's set the rules. Quick.",
    market: "Good. I know your battlefield.",
    experience: {
      beginner: "Then we build you carefully.",
      intermediate: "Then we sharpen what you have.",
      advanced: "Then we hold you to your standard.",
    },
    challenge: {
      entries: "Patience over prediction.",
      exits: "Plan the exit before the entry.",
      risk: "Risk first. Always.",
      discipline: "Then we fix the operator, not the system.",
    },
    goal: "Understood. We aim there.",
    name: "Ready when you are.",
    done: "Training begins.",
  },

  // ---------- Mentor (calm companion mode) ----------
  mentor: {
    greeting: "I'm here. What's on your mind?",
    empty: "I have your full picture. Where do you want to start?",
    watching: "With you.",
    actions: {
      continue: "Continue",
      adjust: "Adjust",
      review: "Review",
      ack: "Got it",
    },
  },

  // ---------- Generic fallbacks ----------
  fallback: {
    quietError: "Something slipped. Try once more.",
    offline: "I'll catch up when you're back online.",
  },
} as const;

/** Pick a verdict line by string key, with safe fallback. */
export function senecaVerdict(v: string | null | undefined): string {
  if (v === "valid") return SenecaVoice.verdict.valid;
  if (v === "weak") return SenecaVoice.verdict.weak;
  if (v === "invalid") return SenecaVoice.verdict.invalid;
  return SenecaVoice.thinking;
}

/** Pick the right block message for the current TraderState.blocks shape. */
export function senecaBlock(blocks: {
  no_strategy?: boolean;
  not_confirmed?: boolean;
  discipline_locked?: boolean;
  in_recovery?: boolean;
}): string | null {
  if (blocks.in_recovery) return SenecaVoice.blocks.inRecovery;
  if (blocks.discipline_locked) return SenecaVoice.blocks.disciplineLocked;
  if (blocks.no_strategy) return SenecaVoice.blocks.noStrategy;
  if (blocks.not_confirmed) return SenecaVoice.blocks.notConfirmed;
  return null;
}
