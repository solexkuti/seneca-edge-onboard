import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import Slide1Hero from "@/components/onboarding/Slide1Hero";
import Slide2Intelligence from "@/components/onboarding/Slide2Intelligence";
import Slide3Flow from "@/components/onboarding/Slide3Flow";
import Slide6Building from "@/components/onboarding/Slide6Building";
import SlideControl from "@/components/onboarding/SlideControl";
import SlideStrategy from "@/components/onboarding/SlideStrategy";
import SlideTestimonials from "@/components/onboarding/SlideTestimonials";
import SlideJournal from "@/components/onboarding/SlideJournal";
import SlideMentor from "@/components/onboarding/SlideMentor";
import SlideCTA from "@/components/onboarding/SlideCTA";
import Slide4Market from "@/components/onboarding/Slide4Market";
import SlideExperience from "@/components/onboarding/SlideExperience";
import SlideStruggle from "@/components/onboarding/SlideStruggle";
import SlideGoal from "@/components/onboarding/SlideGoal";
import SlideName from "@/components/onboarding/SlideName";
import SlideAuth from "@/components/onboarding/SlideAuth";
import SlideBuildingLoader from "@/components/onboarding/SlideBuildingLoader";
import Slide7Success from "@/components/onboarding/Slide7Success";
import PhoneFrame from "@/components/onboarding/PhoneFrame";
import ProgressDots from "@/components/onboarding/ProgressDots";
import { saveUserName } from "@/lib/userName";

export type SlideProps = {
  onNext: () => void;
};

// Narrative slides auto-advance. Question/input slides wait for the user.
// Final flow: psychology → AI mentor preview → 4 questions → name → auth → build → success.
const slideOrder = [
  { key: "pressure", auto: 4200, Component: Slide1Hero },
  { key: "behavior", auto: 5200, Component: Slide2Intelligence },
  { key: "rules", auto: 4200, Component: Slide3Flow },
  { key: "discipline", auto: 4200, Component: Slide6Building },
  { key: "control", auto: 4500, Component: SlideControl },
  { key: "strategy", auto: 5500, Component: SlideStrategy },
  { key: "testimonials", auto: 7800, Component: SlideTestimonials },
  { key: "journal", auto: 5200, Component: SlideJournal },
  { key: "mentor", auto: 5500, Component: SlideMentor },
  { key: "cta", auto: 0, Component: SlideCTA },
  { key: "market", auto: 0, Component: Slide4Market },
  { key: "experience", auto: 0, Component: SlideExperience },
  { key: "struggle", auto: 0, Component: SlideStruggle },
  { key: "goal", auto: 0, Component: SlideGoal },
  { key: "name", auto: 0, Component: SlideName },
  { key: "auth", auto: 0, Component: SlideAuth },
  { key: "loader", auto: 4500, Component: SlideBuildingLoader },
  { key: "success", auto: 0, Component: Slide7Success },
] as const;

export default function OnboardingFlow() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const slide = slideOrder[index];

  const goNext = () => {
    setDirection(1);
    setIndex((i) => Math.min(i + 1, slideOrder.length - 1));
  };

  const goTo = (target: number) => {
    if (target === index) return;
    if (target > index) return; // never jump forward via dots
    setDirection(-1);
    setIndex(target);
  };

  const enterApp = () => {
    if (name.trim()) saveUserName(name.trim());
    navigate({ to: "/hub" });
  };

  // Auto-advance for slides with auto duration
  useEffect(() => {
    if (slide.auto > 0) {
      const t = window.setTimeout(goNext, slide.auto);
      return () => window.clearTimeout(t);
    }
  }, [index, slide.auto]);

  const Component = slide.Component;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow" />
      {/* Subtle floating chart lines background */}
      <BackdropLines />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[440px] flex-col px-5 pt-6 pb-8">
        {/* Top brand row */}
        <div className="flex items-center justify-between">
          <BrandMark />
          <ProgressDots
            count={slideOrder.length}
            active={index}
            onSelect={goTo}
          />
        </div>

        {/* Slide stage */}
        <div className="relative mt-4 flex flex-1 items-center justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.key}
              custom={direction}
              initial={{ opacity: 0, y: direction === 1 ? 24 : -24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: direction === 1 ? -16 : 16, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              {slide.key === "name" ? (
                <SlideName
                  onNext={goNext}
                  value={name}
                  onChange={setName}
                />
              ) : slide.key === "success" ? (
                <Slide7Success onNext={enterApp} userName={name} />
              ) : (
                <Component onNext={goNext} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-9 w-9 rounded-2xl bg-gradient-primary shadow-glow-primary">
        <div className="absolute inset-[3px] rounded-[14px] bg-card/85 backdrop-blur" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path
              d="M3 16 L9 10 L13 14 L21 6"
              fill="none"
              stroke="url(#bm)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6C5CE7" />
                <stop offset="100%" stopColor="#00C6FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div className="leading-none">
        <div className="text-[15px] font-semibold tracking-tight text-text-primary">
          SenecaEdge
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-secondary">
          Trading AI
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
