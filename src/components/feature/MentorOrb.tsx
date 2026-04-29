// MentorOrb — global floating entry to the AI Mentor.
// Always visible (except on the mentor route itself), bottom-right,
// with a calm pulse. Tap → /hub/mentor.

import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const HIDE_ON = ["/hub/mentor", "/auth", "/login", "/onboarding"];

export default function MentorOrb() {
  const { pathname } = useLocation();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <Link
      to="/hub/mentor"
      preload="intent"
      aria-label="Open Seneca mentor"
      className="fixed bottom-5 right-5 z-50 outline-none"
    >
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-12 w-12 items-center justify-center"
      >
        {/* slow ambient pulse */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/25 blur-md"
          animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.12, 1] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card ring-1 ring-primary/40 shadow-glow-gold active:scale-[0.96] transition-transform">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.4} />
        </span>
      </motion.span>
    </Link>
  );
}
