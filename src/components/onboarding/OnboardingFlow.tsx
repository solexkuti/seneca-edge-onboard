// Onboarding — Seneca training sequence.
//
// Duolingo-style cadence: one question per screen, instant transition on
// answer, persistent progress bar, auto-saved responses, mentor reaction
// after key answers. No narrative slides, no playful chrome — just a
// fast, controlled pull into discipline.
//
// Sequence:
//   1. Open      — mentor greeting
//   2. Market    — choice → mentor reaction
//   3. Experience — choice → mentor reaction (variant)
//   4. Challenge — choice → mentor reaction (variant)
//   5. Goal      — choice → mentor reaction
//   6. Name      — input
//   7. Auth      — sign in / sign up → /hub

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  Bitcoin,
  CandlestickChart,
  DollarSign,
  Globe2,
  LineChart,
  Sprout,
  Activity,
  Crosshair,
  Target,
  DoorOpen,
  Shield,
  Brain,
  TrendingUp,
  Compass,
  Wrench,
} from "lucide-react";
import SlideAuth from "@/components/onboarding/SlideAuth";
import {
  patchProfile,
  readProfile,
  type MarketChoice,
  type ExperienceLevel,
  type ChallengeChoice,
  type GoalChoice,
} from "@/lib/onboardingProfile";
import { saveUserName, getUserName } from "@/lib/userName";
import { supabase } from "@/integrations/supabase/client";
import { syncProfileFromOnboarding } from "@/lib/auth";
import {
  FadeIn,
  MentorLine,
  PrimaryAction,
} from "@/components/seneca";
import { SenecaVoice } from "@/lib/senecaVoice";

// ───────── types ─────────

type StepKey =
  | "open"
  | "market"
  | "experience"
  | "challenge"
  | "goal"
  | "name"
  | "auth";

const STEP_ORDER: StepKey[] = [
  "open",
  "market",
  "experience",
  "challenge",
  "goal",
  "name",
  "auth",
];

const REACTION_MS = 900; // dwell on mentor reaction before auto-advance
const TRANSITION_MS = 220; // visible answer pulse before reaction shows

// ───────── component ─────────

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const [name, setName] = useState<string>(() => getUserName() ?? "");
  const profile = useRef(readProfile());
  const advanceTimer = useRef<number | null>(null);

  const step = STEP_ORDER[stepIdx];
  const totalQuestionSteps = STEP_ORDER.length - 1; // open doesn't count
  const progressIdx = Math.max(0, stepIdx); // include open as 0

  // If a session already exists (returning OAuth user), skip to /hub.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session?.user) return;
      await syncProfileFromOnboarding(data.session.user.id);
      if (!cancelled) navigate({ to: "/hub" });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const clearTimers = () => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };
  useEffect(() => clearTimers, []);

  const goNext = () => {
    clearTimers();
    setReaction(null);
    setStepIdx((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  };

  /** Save answer, briefly show mentor reaction, auto-advance. */
  const answer = (patch: Partial<typeof profile.current>, reactLine: string) => {
    patchProfile(patch);
    profile.current = { ...profile.current, ...patch };
    // Show mentor line immediately (after the chosen-card pulse settles)
    window.setTimeout(() => setReaction(reactLine), TRANSITION_MS);
    // Then advance
    advanceTimer.current = window.setTimeout(goNext, TRANSITION_MS + REACTION_MS);
  };

  return (
    <div className="min-h-svh w-full bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pt-6 pb-10 sm:pt-10">
        {/* Persistent progress bar */}
        <ProgressBar total={totalQuestionSteps} active={progressIdx} />

        {/* Stage */}
        <div className="relative mt-10 flex flex-1 flex-col gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-6"
            >
              {step === "open" && <OpenStep onContinue={goNext} />}

              {step === "market" && (
                <QuestionStep
                  prompt="Which market do you trade?"
                  options={MARKET_OPTIONS}
                  onPick={(id) =>
                    answer({ market: id }, SenecaVoice.onboarding.market)
                  }
                  selected={profile.current.market}
                />
              )}

              {step === "experience" && (
                <QuestionStep
                  prompt="How long have you been trading?"
                  options={EXPERIENCE_OPTIONS}
                  onPick={(id) =>
                    answer(
                      { experience: id },
                      SenecaVoice.onboarding.experience[id],
                    )
                  }
                  selected={profile.current.experience}
                />
              )}

              {step === "challenge" && (
                <QuestionStep
                  prompt="Where do you slip most?"
                  options={CHALLENGE_OPTIONS}
                  onPick={(id) =>
                    answer(
                      { challenge: id },
                      SenecaVoice.onboarding.challenge[id],
                    )
                  }
                  selected={profile.current.challenge}
                />
              )}

              {step === "goal" && (
                <QuestionStep
                  prompt="What do you want from this?"
                  options={GOAL_OPTIONS}
                  onPick={(id) =>
                    answer({ goal: id }, SenecaVoice.onboarding.goal)
                  }
                  selected={profile.current.goal}
                />
              )}

              {step === "name" && (
                <NameStep
                  value={name}
                  onChange={(v) => {
                    setName(v);
                    saveUserName(v);
                  }}
                  onContinue={() => {
                    if (name.trim().length === 0) return;
                    goNext();
                  }}
                />
              )}

              {step === "auth" && (
                <AuthStep
                  username={name}
                  onAuthed={() => navigate({ to: "/hub" })}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Mentor reaction layer — only after answers */}
          <AnimatePresence>
            {reaction && (
              <motion.div
                key={reaction}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <MentorLine tone="ack">{reaction}</MentorLine>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ───────── progress bar ─────────

function ProgressBar({ total, active }: { total: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
            i <= active ? "bg-foreground/70" : "bg-border/50"
          }`}
        />
      ))}
    </div>
  );
}

// ───────── steps ─────────

function OpenStep({ onContinue }: { onContinue: () => void }) {
  return (
    <FadeIn className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Seneca
        </p>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Before you trade — four questions.
        </h1>
      </div>
      <MentorLine tone="calm">{SenecaVoice.onboarding.open}</MentorLine>
      <PrimaryAction onClick={onContinue}>Begin</PrimaryAction>
    </FadeIn>
  );
}

type Option<T extends string> = {
  id: T;
  label: string;
  icon: React.ReactNode;
};

function QuestionStep<T extends string>({
  prompt,
  options,
  onPick,
  selected,
}: {
  prompt: string;
  options: ReadonlyArray<Option<T>>;
  onPick: (id: T) => void;
  selected: T | undefined;
}) {
  const [chosen, setChosen] = useState<T | null>(null);
  const handle = (id: T) => {
    if (chosen) return; // lock after first pick
    setChosen(id);
    onPick(id);
  };
  return (
    <div className="flex flex-col gap-7">
      <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
        {prompt}
      </h2>
      <ul className="flex flex-col gap-2">
        {options.map((o) => {
          const isChosen = chosen === o.id || (!chosen && selected === o.id);
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => handle(o.id)}
                disabled={!!chosen}
                className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition ${
                  isChosen
                    ? "border-foreground/40 bg-card text-foreground"
                    : "border-border/50 bg-card/40 text-foreground/85 hover:border-border hover:bg-card/70"
                } disabled:cursor-default`}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/50 bg-card/60 text-foreground/70">
                  {o.icon}
                </span>
                <span className="flex-1 font-medium">{o.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NameStep({
  value,
  onChange,
  onContinue,
}: {
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  const ready = value.trim().length > 0;
  return (
    <FadeIn className="flex flex-col gap-7">
      <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
        What should I call you?
      </h2>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && ready) onContinue();
        }}
        placeholder="Your name"
        maxLength={40}
        className="h-13 w-full rounded-2xl border border-border/60 bg-card/40 px-4 py-3 text-base font-medium text-foreground outline-none transition placeholder:font-normal placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:bg-card"
      />
      <MentorLine tone="calm">{SenecaVoice.onboarding.name}</MentorLine>
      <PrimaryAction onClick={onContinue} disabled={!ready}>
        Continue
      </PrimaryAction>
    </FadeIn>
  );
}

function AuthStep({
  username,
  onAuthed,
}: {
  username: string;
  onAuthed: () => void;
}) {
  return (
    <FadeIn className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
          One last step.
        </h2>
        <MentorLine tone="ack">{SenecaVoice.onboarding.done}</MentorLine>
      </div>
      <SlideAuth
        username={username}
        onAuthed={onAuthed}
        onNext={onAuthed}
      />
    </FadeIn>
  );
}

// ───────── option catalogues ─────────

const MARKET_OPTIONS: ReadonlyArray<Option<MarketChoice>> = [
  { id: "forex", label: "Forex", icon: <DollarSign className="h-4 w-4" /> },
  { id: "crypto", label: "Crypto", icon: <Bitcoin className="h-4 w-4" /> },
  { id: "stocks", label: "Stocks", icon: <CandlestickChart className="h-4 w-4" /> },
  { id: "indices", label: "Indices", icon: <LineChart className="h-4 w-4" /> },
  { id: "all", label: "All markets", icon: <Globe2 className="h-4 w-4" /> },
];

const EXPERIENCE_OPTIONS: ReadonlyArray<Option<ExperienceLevel>> = [
  { id: "beginner", label: "Just starting", icon: <Sprout className="h-4 w-4" /> },
  { id: "intermediate", label: "A year or two in", icon: <Activity className="h-4 w-4" /> },
  { id: "advanced", label: "Years of screen time", icon: <Crosshair className="h-4 w-4" /> },
];

const CHALLENGE_OPTIONS: ReadonlyArray<Option<ChallengeChoice>> = [
  { id: "entries", label: "Entries", icon: <Target className="h-4 w-4" /> },
  { id: "exits", label: "Exits", icon: <DoorOpen className="h-4 w-4" /> },
  { id: "risk", label: "Risk", icon: <Shield className="h-4 w-4" /> },
  { id: "discipline", label: "Discipline", icon: <Brain className="h-4 w-4" /> },
];

const GOAL_OPTIONS: ReadonlyArray<Option<GoalChoice>> = [
  { id: "consistency", label: "Consistency", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "better-entries", label: "Better entries", icon: <Crosshair className="h-4 w-4" /> },
  { id: "risk-control", label: "Risk control", icon: <Shield className="h-4 w-4" /> },
  { id: "build-system", label: "Build a system", icon: <Wrench className="h-4 w-4" /> },
];

// Re-export PhoneFrame for any legacy importer.
export { default as PhoneFrame } from "@/components/onboarding/PhoneFrame";

// Type kept for legacy slide files that still import it.
export type SlideProps = { onNext: () => void };
