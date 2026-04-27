// Dynamic, state-aware suggestion buttons for the AI mentor chat.
// Mirrors the backend emotional state classifier so the chips
// reflect what Seneca itself perceived from the user's message.

import {
  AlertTriangle,
  Flame,
  Pause,
  HelpCircle,
  Shield,
  Brain,
  LineChart,
  Sparkles,
  EyeOff,
  Compass,
  Scale,
  Target,
  Coffee,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { JournalEntry } from "@/lib/tradingJournal";
import { computeDiscipline } from "@/lib/tradingJournal";

export type MentorState =
  | "frustrated"
  | "fearful"
  | "overconfident"
  | "confused"
  | "neutral";

export type MentorIntent =
  | "urgent"
  | "mindset"
  | "risk"
  | "analyze"
  | "learn"
  | "help";

export type MentorSuggestion = {
  id: string;
  label: string; // short, conversational
  prompt: string; // what we actually send to the mentor
  icon: LucideIcon;
  intent: MentorIntent;
};

// ── State detection (mirror of supabase/functions/mentor-chat/index.ts) ──
const STATE_PATTERNS: Array<{ state: MentorState; rx: RegExp }> = [
  {
    state: "frustrated",
    rx: /\b(keep losing|always (lose|mess|fail)|i'?m tired|sick of|stupid market|hate this|fed up|nothing works|every time|over and over|again and again|revenge|angry|mad|pissed|frustrated)\b/i,
  },
  {
    state: "overconfident",
    rx: /\b(all in|all-?in|guaranteed|can'?t lose|sure thing|easy money|100%|cant miss|locked in|free money|going to print|crushing it|on fire|nailed it|won big)\b/i,
  },
  {
    state: "fearful",
    rx: /\b(scared|afraid|terrified|frozen|can'?t pull the trigger|what if i lose|nervous|anxious|hesita(te|nt)|worried|paralyz(ed|e)|missed (the|that|another) (trade|setup|move))\b/i,
  },
  {
    state: "confused",
    rx: /\b(don'?t (get|understand)|confus(ed|ing)|too complex|i'?m lost|makes no sense|stuck|no idea|what does .* mean|explain)\b/i,
  },
];

export function detectMentorState(message: string): MentorState {
  const text = (message ?? "").toLowerCase();
  for (const { state, rx } of STATE_PATTERNS) {
    if (rx.test(text)) return state;
  }
  return "neutral";
}

// ── Per-state suggestion pools ──
const POOLS: Record<MentorState, MentorSuggestion[]> = {
  frustrated: [
    { id: "f-review", label: "Review my last trade", prompt: "Can you walk me through my last trade and what went wrong?", icon: LineChart, intent: "analyze" },
    { id: "f-force", label: "I feel like forcing trades", prompt: "I feel the urge to force trades right now. Help me slow down.", icon: Flame, intent: "urgent" },
    { id: "f-reset", label: "Help me reset", prompt: "I need to reset mentally before I do something stupid. What should I do right now?", icon: Pause, intent: "mindset" },
    { id: "f-wrong", label: "What did I do wrong?", prompt: "What pattern keeps showing up in my recent trades that I'm not seeing?", icon: AlertTriangle, intent: "analyze" },
    { id: "f-step-away", label: "Should I step away?", prompt: "Be honest — should I stop trading for today?", icon: Coffee, intent: "mindset" },
  ],
  fearful: [
    { id: "x-scared", label: "I'm scared to enter", prompt: "I see a setup but I'm scared to enter. Help me think through it.", icon: EyeOff, intent: "mindset" },
    { id: "x-valid", label: "Was my setup valid?", prompt: "Help me check if the setup I'm looking at is actually valid.", icon: Target, intent: "analyze" },
    { id: "x-trust", label: "Help me trust my system", prompt: "I'm losing trust in my system after recent trades. How do I rebuild it?", icon: Shield, intent: "mindset" },
    { id: "x-hesitate", label: "Why do I hesitate?", prompt: "Why do I keep hesitating on valid setups?", icon: HelpCircle, intent: "help" },
    { id: "x-missed", label: "I keep missing trades", prompt: "I keep missing setups and then chasing them. What's going on?", icon: RefreshCw, intent: "mindset" },
  ],
  overconfident: [
    { id: "o-over", label: "Am I overtrading?", prompt: "Be honest — am I overtrading right now?", icon: AlertTriangle, intent: "analyze" },
    { id: "o-stop", label: "Should I stop for today?", prompt: "I'm up today. Should I stop now or keep going?", icon: Pause, intent: "mindset" },
    { id: "o-discipline", label: "Check my discipline", prompt: "Look at my recent trades and tell me if my discipline is slipping.", icon: Scale, intent: "analyze" },
    { id: "o-objective", label: "Review my last win objectively", prompt: "Review my last winning trade objectively — was it skill or luck?", icon: LineChart, intent: "analyze" },
    { id: "o-ego", label: "Am I getting cocky?", prompt: "I feel like I can't lose right now. Reality check me.", icon: Flame, intent: "urgent" },
  ],
  confused: [
    { id: "c-simple", label: "Explain this simply", prompt: "Can you explain what we were just talking about in the simplest possible way?", icon: Sparkles, intent: "learn" },
    { id: "c-focus", label: "What should I focus on?", prompt: "There's too much going on. What's the one thing I should focus on right now?", icon: Compass, intent: "help" },
    { id: "c-break", label: "Break this down for me", prompt: "Break this down for me step by step.", icon: Brain, intent: "learn" },
    { id: "c-wrong", label: "Where did I go wrong?", prompt: "Where exactly did my thinking go off track?", icon: HelpCircle, intent: "analyze" },
    { id: "c-start", label: "Where do I even start?", prompt: "I feel lost. Where do I even start with my trading right now?", icon: Compass, intent: "help" },
  ],
  neutral: [
    { id: "n-pre", label: "Check before trade", prompt: "I'm about to take a trade. Walk me through a quick pre-trade check.", icon: Shield, intent: "risk" },
    { id: "n-system", label: "Review my system", prompt: "Help me review my trading system — what's working and what isn't?", icon: Scale, intent: "analyze" },
    { id: "n-last", label: "Analyze my last trade", prompt: "Help me analyze my last trade objectively.", icon: LineChart, intent: "analyze" },
    { id: "n-improve", label: "How can I improve?", prompt: "Looking at my recent trades, what's the one thing I should improve?", icon: Target, intent: "help" },
    { id: "n-mindset", label: "Mindset check", prompt: "Quick mindset check — how should I be approaching the next trade?", icon: Brain, intent: "mindset" },
  ],
};

// ── Personalized injection from journal ──
// Replaces ONE suggestion with a journal-aware one when real data exists.
function buildPersonalized(journal: JournalEntry[]): MentorSuggestion | null {
  if (!journal.length) return null;

  const sorted = [...journal].sort((a, b) => b.timestamp - a.timestamp);
  const last = sorted[0];
  const discipline = computeDiscipline(journal);

  // Today's broken-rule count
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const brokeToday = journal.filter(
    (e) => e.timestamp >= startOfToday.getTime() && e.followedPlan === false,
  ).length;

  // Priority 1: discipline drop
  if (discipline !== null && discipline < 70) {
    return {
      id: "p-discipline",
      label: `Discipline at ${discipline}% — check why`,
      prompt: `My discipline score has dropped to ${discipline}%. What's driving this and how do I fix it?`,
      icon: Scale,
      intent: "analyze",
    };
  }

  // Priority 2: rules broken multiple times today
  if (brokeToday >= 3) {
    return {
      id: "p-broken",
      label: `Broke rules ${brokeToday} times today — fix it`,
      prompt: `I've broken my trading rules ${brokeToday} times today. Help me figure out what's really going on.`,
      icon: AlertTriangle,
      intent: "urgent",
    };
  }

  // Priority 3: review the last trade specifically
  if (last) {
    const sign = last.resultR >= 0 ? "+" : "";
    return {
      id: "p-last",
      label: `Review your ${last.pair} ${last.resultR >= 0 ? "win" : "loss"} (${sign}${last.resultR}R)`,
      prompt: `Help me review my last trade: ${last.pair}, result ${sign}${last.resultR}R${
        typeof last.followedPlan === "boolean"
          ? last.followedPlan
            ? " (followed plan)"
            : " (broke plan)"
          : ""
      }. What can I learn from it?`,
      icon: LineChart,
      intent: "analyze",
    };
  }

  return null;
}

// Pick 4 suggestions for the current state, avoiding ones recently shown.
// Keeps the personalized chip first when available.
export function pickMentorSuggestions(args: {
  state: MentorState;
  journal: JournalEntry[];
  recentlyShownIds: string[];
}): MentorSuggestion[] {
  const { state, journal, recentlyShownIds } = args;
  const pool = POOLS[state];
  const recent = new Set(recentlyShownIds);

  // Prefer items not recently shown; fall back to full pool if needed.
  const fresh = pool.filter((s) => !recent.has(s.id));
  const ordered = [...fresh, ...pool.filter((s) => recent.has(s.id))];

  const personalized = buildPersonalized(journal);
  const result: MentorSuggestion[] = [];

  if (personalized) result.push(personalized);
  for (const s of ordered) {
    if (result.length >= 4) break;
    if (result.find((x) => x.id === s.id)) continue;
    result.push(s);
  }
  return result.slice(0, 4);
}

export const INTENT_STYLES: Record<MentorIntent, string> = {
  urgent: "text-highlight-pink",
  mindset: "text-brand",
  risk: "text-emerald-600",
  analyze: "text-accent-cyan",
  learn: "text-accent-blue",
  help: "text-text-secondary",
};
