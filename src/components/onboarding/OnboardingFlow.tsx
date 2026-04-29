import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import Slide1Hero from "@/components/onboarding/Slide1Hero";
import SlideBridge from "@/components/onboarding/SlideBridge";
import SlideReframe from "@/components/onboarding/SlideReframe";
import SlideSolution from "@/components/onboarding/SlideSolution";
import Slide2Intelligence from "@/components/onboarding/Slide2Intelligence";
import Slide6Building from "@/components/onboarding/Slide6Building";
import SlideProof from "@/components/onboarding/SlideProof";
import Slide4Market from "@/components/onboarding/Slide4Market";
import SlideExperience from "@/components/onboarding/SlideExperience";
import SlideStruggle from "@/components/onboarding/SlideStruggle";
import SlideGoal from "@/components/onboarding/SlideGoal";
import SlideName from "@/components/onboarding/SlideName";
import SlideAuth from "@/components/onboarding/SlideAuth";
import PhoneFrame from "@/components/onboarding/PhoneFrame";
import SegmentedProgress from "@/components/onboarding/SegmentedProgress";
import { saveUserName, getUserName } from "@/lib/userName";
import { supabase } from "@/integrations/supabase/client";
import { syncProfileFromOnboarding } from "@/lib/auth";

export type SlideProps = {
  onNext: () => void;
};

/**
 * Auto-guided onboarding.
 *
 *   • Narrative slides auto-advance after a calm dwell (3–6s).
 *   • Swipe left/right to move between slides at any time.
 *   • Proof has the only narrative CTA → enters personalization.
 *   • Question slides advance on selection.
 *   • Final tail: Name → Signup → /hub (control state).
 */
const slideOrder = [
  // Narrative — auto-advance
  { key: "hook", auto: 4500, Component: Slide1Hero },
  { key: "bridge", auto: 6000, Component: SlideBridge },
  { key: "reframe", auto: 4500, Component: SlideReframe },
  { key: "solution", auto: 5000, Component: SlideSolution },
  { key: "experience", auto: 5000, Component: Slide2Intelligence },
  { key: "features", auto: 6000, Component: Slide6Building },
  // Final narrative — manual CTA only
  { key: "proof", auto: 0, Component: SlideProof },
  // Personalization — manual selection
  { key: "q-market", auto: 0, Component: Slide4Market },
  { key: "q-experience", auto: 0, Component: SlideExperience },
  { key: "q-challenge", auto: 0, Component: SlideStruggle },
  { key: "q-goal", auto: 0, Component: SlideGoal },
  // Identity → signup → control state
  { key: "name", auto: 0, Component: SlideName },
  { key: "auth", auto: 0, Component: SlideAuth },
] as const;

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [userName, setUserName] = useState<string>(() => getUserName() ?? "");
  const advanceTimer = useRef<number | null>(null);

  // If the user already has a session (e.g. returning from Google OAuth),
  // sync their profile and jump straight into the control state.
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

  const slide = slideOrder[index];
  const isLast = index >= slideOrder.length - 1;

  const clearTimers = () => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const goNext = () => {
    clearTimers();
    // Advancing past the final slide (auth) → enter the control state.
    if (slideOrder[index].key === "auth") {
      navigate({ to: "/hub" });
      return;
    }
    setDirection(1);
    setIndex((i) => Math.min(i + 1, slideOrder.length - 1));
  };
  const goPrev = () => {
    clearTimers();
    setDirection(-1);
    setIndex((i) => Math.max(i - 1, 0));
  };
  const goTo = (target: number) => {
    if (target === index) return;
    if (target > index) return; // never jump forward via the bar
    clearTimers();
    setDirection(-1);
    setIndex(target);
  };

  // Auto-advance schedule — runs uninterrupted; only swipes / selections move slides.
  useEffect(() => {
    clearTimers();
    if (slide.auto > 0 && !isLast) {
      advanceTimer.current = window.setTimeout(goNext, slide.auto);
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // SlideAuth + SlideName are rendered explicitly below; this cast keeps
  // the generic narrative/question slides callable with just `onNext`.
  const Component = slide.Component as React.ComponentType<SlideProps>;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Background ambient */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow" />
      <BackdropLines />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[440px] flex-col px-5 pb-8 pt-[40px]">
        {/* Progress bar */}
        <header className="px-1">
          <SegmentedProgress
            count={slideOrder.length}
            active={index}
            duration={slide.auto}
            onSelect={goTo}
          />
        </header>

        {/* Slide stage */}
        <div className="relative mt-8 flex flex-1 items-center justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.key}
              custom={direction}
              initial={{ opacity: 0, x: direction === 1 ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction === 1 ? -30 : 30 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              drag="x"
              dragElastic={0.18}
              dragMomentum={false}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                const threshold = 60;
                const velocity = 400;
                if (info.offset.x < -threshold || info.velocity.x < -velocity) {
                  goNext();
                } else if (
                  info.offset.x > threshold ||
                  info.velocity.x > velocity
                ) {
                  goPrev();
                }
              }}
              className="w-full touch-pan-y cursor-grab active:cursor-grabbing"
            >
              {slide.key === "name" ? (
                <SlideName
                  onNext={goNext}
                  value={userName}
                  onChange={(v) => {
                    setUserName(v);
                    saveUserName(v);
                  }}
                />
              ) : slide.key === "auth" ? (
                <SlideAuth
                  onNext={goNext}
                  username={userName}
                  onAuthed={() => navigate({ to: "/hub" })}
                />
              ) : (
                React.createElement(
                  Component as React.ComponentType<SlideProps>,
                  { onNext: goNext },
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function BackdropLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
      viewBox="0 0 400 800"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="bg-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0" />
          <stop offset="50%" stopColor="#6C5CE7" stopOpacity="1" />
          <stop offset="100%" stopColor="#00C6FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M-10 220 Q 80 180 160 230 T 410 200"
        fill="none"
        stroke="url(#bg-line)"
        strokeWidth="1.5"
      />
      <path
        d="M-10 520 Q 110 470 200 510 T 420 480"
        fill="none"
        stroke="url(#bg-line)"
        strokeWidth="1.5"
      />
      <path
        d="M-10 690 Q 90 650 180 680 T 420 660"
        fill="none"
        stroke="url(#bg-line)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export { PhoneFrame };
