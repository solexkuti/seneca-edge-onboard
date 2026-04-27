import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Slide1Hero from "@/components/onboarding/Slide1Hero";
import SlideBridge from "@/components/onboarding/SlideBridge";
import Slide2Intelligence from "@/components/onboarding/Slide2Intelligence";
import Slide6Building from "@/components/onboarding/Slide6Building";
import SlideProof from "@/components/onboarding/SlideProof";
import Slide4Market from "@/components/onboarding/Slide4Market";
import SlideExperience from "@/components/onboarding/SlideExperience";
import SlideStruggle from "@/components/onboarding/SlideStruggle";
import SlideGoal from "@/components/onboarding/SlideGoal";
import Slide3Flow from "@/components/onboarding/Slide3Flow";
import PhoneFrame from "@/components/onboarding/PhoneFrame";
import ProgressDots from "@/components/onboarding/ProgressDots";

export type SlideProps = {
  onNext: () => void;
};

/**
 * Onboarding — narrative previews → 4-step personalization → path picker.
 *
 *   1. Hero          — emotional hook, single CTA (manual)
 *   2. Mockup        — animated phone, floating overlay (auto)
 *   3. Features      — 3 cards (auto)
 *   4. Proof         — soft trust layer + 1 testimonial (auto)
 *   5. Market        — Step 1/4 personalization (manual)
 *   6. Experience    — Step 2/4 personalization (manual)
 *   7. Challenge     — Step 3/4 personalization (manual)
 *   8. Goal          — Step 4/4 personalization (manual)
 *   9. Path          — pick a path → confirmation → route into the chosen flow
 *
 * Personalization answers are persisted to localStorage and read by Seneca
 * AI as USER CONTEXT on first interaction (see src/lib/onboardingProfile.ts).
 */
const slideOrder = [
  { key: "hook", auto: 0, Component: Slide1Hero },
  { key: "bridge", auto: 0, Component: SlideBridge },
  { key: "experience", auto: 5200, Component: Slide2Intelligence },
  { key: "features", auto: 5200, Component: Slide6Building },
  { key: "proof", auto: 6200, Component: SlideProof },
  { key: "q-market", auto: 0, Component: Slide4Market },
  { key: "q-experience", auto: 0, Component: SlideExperience },
  { key: "q-challenge", auto: 0, Component: SlideStruggle },
  { key: "q-goal", auto: 0, Component: SlideGoal },
  { key: "path", auto: 0, Component: Slide3Flow },
] as const;

export default function OnboardingFlow() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const slide = slideOrder[index];

  const goNext = () => {
    setDirection(1);
    setIndex((i) => Math.min(i + 1, slideOrder.length - 1));
  };

  const goPrev = () => {
    setDirection(-1);
    setIndex((i) => Math.max(i - 1, 0));
  };

  const goTo = (target: number) => {
    if (target === index) return;
    if (target > index) return; // never jump forward via dots
    setDirection(-1);
    setIndex(target);
  };

  // Swipe is enabled on auto-advancing narrative slides.
  // Disabled on the hook (single CTA) and the path picker (taps).
  const swipeEnabled = slide.auto > 0;

  // Auto-advance for narrative slides
  useEffect(() => {
    if (slide.auto > 0) {
      const t = window.setTimeout(goNext, slide.auto);
      return () => window.clearTimeout(t);
    }
  }, [index, slide.auto]);

  const Component = slide.Component;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Background ambient */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow" />
      <BackdropLines />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[440px] flex-col px-5 pb-8 pt-[48px]">
        {/* Progress dots */}
        <header className="flex justify-center">
          <ProgressDots
            count={slideOrder.length}
            active={index}
            onSelect={goTo}
          />
        </header>

        {/* Slide stage */}
        <div className="relative mt-8 flex flex-1 items-center justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.key}
              custom={direction}
              initial={{ opacity: 0, x: direction === 1 ? 40 : -40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: direction === 1 ? -40 : 40, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              drag={swipeEnabled ? "x" : false}
              dragElastic={0.18}
              dragMomentum={false}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (!swipeEnabled) return;
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
              className={`w-full ${swipeEnabled ? "touch-pan-y cursor-grab active:cursor-grabbing" : ""}`}
            >
              <Component onNext={goNext} />
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
