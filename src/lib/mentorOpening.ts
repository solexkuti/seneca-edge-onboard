// Path-aware first interaction for Seneca, set during onboarding (Slide 5).
// Reads `seneca_start_path` from localStorage and returns the right opening
// message + quick-reply chips. The path is consumed once and then cleared so
// subsequent visits land in the normal dynamic-suggestion flow.
//
// Voice rules are mirrored from the spec — keep these phrasings stable; they
// are part of the brand. Tweak with care.

import {
  HelpCircle,
  LogIn,
  LogOut,
  Shield,
  Sparkles,
  Compass,
  Zap,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { MentorIntent, MentorSuggestion } from "@/lib/mentorSuggestions";

export type StartPath = "learn" | "review" | "plan";

const STORAGE_KEY = "seneca_start_path";

export function readStartPath(): StartPath | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "learn" || raw === "review" || raw === "plan") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearStartPath() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type Opening = {
  /** Initial assistant message — replaces the generic intro. */
  message: string;
  /** Quick-reply chips paired with the opening (max 4, per spec). */
  chips: MentorSuggestion[];
};

const chip = (
  id: string,
  label: string,
  prompt: string,
  icon: LucideIcon,
  intent: MentorIntent,
): MentorSuggestion => ({ id, label, prompt, icon, intent });

const OPENINGS: Record<StartPath, Opening> = {
  learn: {
    message:
      "We'll keep this simple. You don't need more information… you need clarity.\n\nTell me honestly — what confuses you the most when you're trading?",
    chips: [
      chip("learn-entry", "When to enter", "What I struggle with most is knowing when to enter a trade.", LogIn, "learn"),
      chip("learn-exit", "When to exit", "What I struggle with most is knowing when to exit a trade.", LogOut, "learn"),
      chip("learn-risk", "Risk management", "What confuses me most is risk management.", Shield, "risk"),
      chip("learn-all", "Everything feels confusing", "Honestly, everything feels confusing right now.", HelpCircle, "help"),
    ],
  },
  review: {
    message:
      "Let's look at it together. No pressure.\n\nSend me your last trade — even if it didn't go well. Pair, direction, what made you take it, and how it ended is plenty.",
    chips: [
      chip(
        "review-loss",
        "It was a loss",
        "My last trade was a loss. Help me look at it without making it heavier than it needs to be.",
        TrendingUp,
        "analyze",
      ),
      chip(
        "review-messy",
        "It was messy",
        "Honestly the trade was messy — I'm not sure I followed my plan.",
        Sparkles,
        "analyze",
      ),
      chip(
        "review-unsure",
        "I'm not sure where to start",
        "I want to review my last trade but I'm not sure where to start.",
        Compass,
        "help",
      ),
      chip(
        "review-pattern",
        "Spot a pattern",
        "Look across my recent trades and tell me what pattern you're seeing.",
        Zap,
        "analyze",
      ),
    ],
  },
  plan: {
    message:
      "Good decision. Most traders think they have a plan… but it's usually just habits. Let's make yours clear.\n\nTo start: how do you currently enter trades?",
    chips: [
      chip("plan-breakout", "Breakout", "I usually enter on breakouts.", Zap, "analyze"),
      chip("plan-pullback", "Pullback", "I usually enter on pullbacks.", TrendingUp, "analyze"),
      chip("plan-instinct", "I mostly go by instinct", "Honestly, I mostly go by instinct when I enter.", Sparkles, "mindset"),
      chip("plan-unsure", "I'm not sure", "I'm not really sure how I enter — it varies.", HelpCircle, "help"),
    ],
  },
};

export function getOpeningFor(path: StartPath): Opening {
  return OPENINGS[path];
}
