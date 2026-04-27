import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * Reusable calm "Continue" CTA used on narrative onboarding slides.
 * Matches the gradient pill used on Hero / Bridge / Reframe.
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
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-soft"
    >
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2.4}
      />
    </motion.button>
  );
}
