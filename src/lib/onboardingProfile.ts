// Persistent personalization profile captured during the 4-step onboarding flow.
// Used by Seneca AI for context. Stored in localStorage — no backend round-trip.

export type MarketChoice = "forex" | "crypto" | "stocks" | "indices" | "all";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type ChallengeChoice = "entries" | "exits" | "risk" | "discipline";
export type GoalChoice =
  | "consistency"
  | "better-entries"
  | "risk-control"
  | "build-system";

export type OnboardingProfile = {
  /** Selected markets (multi-select). Empty/undefined when not yet chosen. */
  markets?: MarketChoice[];
  experience?: ExperienceLevel;
  challenge?: ChallengeChoice;
  goal?: GoalChoice;
};

const KEY = "seneca_profile";

export function readProfile(): OnboardingProfile {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingProfile) : {};
  } catch {
    return {};
  }
}

export function patchProfile(patch: Partial<OnboardingProfile>) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readProfile(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Human-readable summary used in the mentor's USER CONTEXT block. */
export function summarizeProfile(p: OnboardingProfile): string | null {
  const parts: string[] = [];
  if (p.market) {
    const marketLabel: Record<MarketChoice, string> = {
      forex: "Forex",
      crypto: "Crypto",
      stocks: "Stocks",
      indices: "Indices",
      all: "All markets",
    };
    parts.push(`Trades: ${marketLabel[p.market]}`);
  }
  if (p.experience) {
    const expLabel: Record<ExperienceLevel, string> = {
      beginner: "Beginner",
      intermediate: "Intermediate",
      advanced: "Advanced",
    };
    parts.push(`Experience: ${expLabel[p.experience]}`);
  }
  if (p.challenge) {
    const chLabel: Record<ChallengeChoice, string> = {
      entries: "Entries",
      exits: "Exits",
      risk: "Risk management",
      discipline: "Discipline / emotions",
    };
    parts.push(`Biggest struggle: ${chLabel[p.challenge]}`);
  }
  if (p.goal) {
    const goalLabel: Record<GoalChoice, string> = {
      consistency: "Consistency",
      "better-entries": "Better entries",
      "risk-control": "Better risk control",
      "build-system": "Build a solid system",
    };
    parts.push(`Goal right now: ${goalLabel[p.goal]}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
