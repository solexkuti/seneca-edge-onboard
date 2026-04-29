import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import SlideFeeling from "@/components/onboarding/SlideFeeling";
import SlideSystem from "@/components/onboarding/SlideSystem";
import SlideEdge from "@/components/onboarding/SlideEdge";
import SlideTestimonial from "@/components/onboarding/SlideTestimonial";
import Slide4Market from "@/components/onboarding/Slide4Market";
import SlideExperience from "@/components/onboarding/SlideExperience";
import SlideStruggle from "@/components/onboarding/SlideStruggle";
import SlideGoal from "@/components/onboarding/SlideGoal";
import SlideCalibration from "@/components/onboarding/SlideCalibration";
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
 * Premium, Apple-level onboarding.
 *
 * Manual-only progression — every slide stops fully and waits for the user.
 * Narrative slides expose a "Continue" CTA. Personalization slides advance
 * on selection. Final tail: Name → Auth → /hub.
 */
const slideOrder = [
  // Narrative — manual continue
  { key: "feeling", Component: SlideFeeling },
  { key: "system", Component: SlideSystem },
  { key: "edge", Component: SlideEdge },
  { key: "testimonial", Component: SlideTestimonial },
  // Personalization — advance on selection
  { key: "q-market", Component: Slide4Market },
  { key: "q-experience", Component: SlideExperience },
  { key: "q-challenge", Component: SlideStruggle },
  { key: "q-goal", Component: SlideGoal },
  // Calibration — auto-advance after ~2.6s
  { key: "calibration", Component: SlideCalibration },
  // Identity → signup → control state
  { key: "name", Component: SlideName },
  { key: "auth", Component: SlideAuth },
] as const;

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [userName, setUserName] = useState<string>(() => getUserName() ?? "");

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

  const goNext = () => {
    if (slideOrder[index].key === "auth") {
      navigate({ to: "/hub" });
      return;
    }
    setDirection(1);
    setIndex((i) => Math.min(i + 1, slideOrder.length - 1));
  };
  const goPrev = () => {
    setDirection(-1);
    setIndex((i) => Math.max(i - 1, 0));
  };
  const goTo = (target: number) => {
    if (target === index) return;
    if (target > index) return; // never jump forward
    setDirection(-1);
    setIndex(target);
  };

  const Component = slide.Component as React.ComponentType<SlideProps>;

  // Subtle per-slide ambient glow positions — calm, no extra motion.
  const GLOW_POSITIONS = [
    { top: "14%", left: "20%" },
    { top: "22%", left: "72%" },
    { top: "62%", left: "28%" },
    { top: "70%", left: "76%" },
    { top: "40%", left: "50%" },
  ];
  const glow = GLOW_POSITIONS[index % GLOW_POSITIONS.length];

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Deep base — slight depth gradient, never flat black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, #121214 0%, #0B0B0D 55%, #060607 100%)",
        }}
      />

      {/* Per-slide warm gold ambient glow — slow fade between slides */}
      <motion.div
        aria-hidden
        key={`glow-${index}`}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="pointer-events-none absolute z-0 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(198,161,91,0.16),transparent_65%)] blur-3xl"
        style={{ top: glow.top, left: glow.left }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[440px] flex-col px-5 pb-10 pt-[40px]">
        {/* Progress bar — manual flow, no dwell timer */}
        <header className="relative px-1">
          <SegmentedProgress
            count={slideOrder.length}
            active={index}
            duration={0}
            onSelect={goTo}
          />
        </header>

        {/* Back button — sits BELOW the progress bar with comfortable spacing
            so it never overlaps. Hidden on first, calibration, and auth. */}
        <div className="relative mt-5 h-5 px-1">
          {index > 0 &&
            slide.key !== "calibration" &&
            slide.key !== "auth" && (
              <motion.button
                type="button"
                onClick={goPrev}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                aria-label="Back"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-text-secondary transition-colors hover:text-gold-soft"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
                Back
              </motion.button>
            )}
        </div>

        {/* Slide stage */}
        <div className="relative mt-10 flex flex-1 items-center justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.key}
              custom={direction}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
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

export { PhoneFrame };
