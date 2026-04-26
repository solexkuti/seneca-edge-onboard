import { motion } from "framer-motion";
import { Upload, Cpu, Sparkles, ArrowRight } from "lucide-react";
import PhoneFrame from "./PhoneFrame";
import type { SlideProps } from "./OnboardingFlow";

export default function Slide3Flow({ onNext }: SlideProps) {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="relative">
        <PhoneFrame className="animate-float-slow">
          <FlowScreen />
        </PhoneFrame>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-tight text-text-primary">
          Upload chart →{" "}
          <span className="text-gradient-mix">Get insight ⚡</span>
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">It's that simple.</p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        onClick={onNext}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-primary px-6 py-4 shadow-glow-primary"
      >
        <span className="absolute inset-0 bg-gradient-flash opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="relative flex items-center justify-center gap-2 text-[16px] font-semibold text-white">
          Get Started
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </motion.button>
    </div>
  );
}

function FlowScreen() {
  const steps = [
    { icon: Upload, label: "Upload chart", color: "#A29BFE" },
    { icon: Cpu, label: "Analyze", color: "#6C5CE7" },
    { icon: Sparkles, label: "Result", color: "#00C6FF" },
  ];
  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#0F172A] to-[#1A1B3A] p-5 pt-12">
      <div className="absolute -right-12 top-20 h-32 w-32 rounded-full bg-[#6C5CE7] opacity-30 blur-3xl" />
      <div className="absolute -left-12 bottom-10 h-32 w-32 rounded-full bg-[#00C6FF] opacity-30 blur-3xl" />

      <div className="relative space-y-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.25, duration: 0.5 }}
              className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${s.color}, ${s.color}99)`,
                  boxShadow: `0 8px 24px -8px ${s.color}99`,
                }}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-semibold text-white">
                  {s.label}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{
                      delay: 0.5 + i * 0.4,
                      duration: 0.9,
                      ease: "easeOut",
                    }}
                    className="h-full"
                    style={{
                      background: `linear-gradient(90deg, ${s.color}, #FFFFFF)`,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Result preview */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="mt-4 rounded-2xl bg-gradient-mix p-[1px]"
        >
          <div className="rounded-2xl bg-[#0F172A] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                AI Insight
              </span>
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                READY
              </span>
            </div>
            <div className="mt-1 text-[13px] font-semibold text-white">
              Bullish reversal · 87% conf.
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
