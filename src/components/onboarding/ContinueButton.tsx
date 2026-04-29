import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { playFeedback } from "@/lib/feedback";

/**
 * Calm, premium "Continue" CTA used on every narrative onboarding slide.
 * Gold gradient on dark — matches the global Dark + Gold identity.
 */
export default function ContinueButton({
  onClick,
  delay = 0.5,
  label = "Continue",
}: {
  onClick: () => void;
  delay?: number;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        playFeedback("press");
        onClick();
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className="btn-gold focus-glow group inline-flex items-center gap-2 px-7 py-3.5 text-[15px] font-semibold text-[#0B0B0D]"
    >
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2.4}
      />
    </motion.button>
  );
}
