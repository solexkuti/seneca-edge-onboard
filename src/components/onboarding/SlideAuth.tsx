import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, ArrowLeft } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

export default function SlideAuth({
  onNext,
  username,
}: SlideProps & { username?: string }) {
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canSubmitEmail =
    email.trim().length > 3 && email.includes("@") && password.length >= 6;

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            One last step
          </span>
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-text-primary">
          Everything is <span className="text-gradient-mix">ready.</span>
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          Save your setup and step into control.
        </p>
        {username && (
          <p className="mt-1.5 text-[12px] text-text-secondary/80">
            This will be saved as{" "}
            <span className="font-semibold text-text-primary">{username}</span>
          </p>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {mode === "choose" ? (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-2.5"
          >
            <SocialButton
              label="Continue with Google"
              onClick={onNext}
              icon={<GoogleIcon />}
            />
            <SocialButton
              label="Continue with Apple"
              onClick={onNext}
              icon={<AppleIcon />}
              dark
            />

            <div className="my-2 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode("email")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-4 text-[15px] font-semibold text-text-primary shadow-soft transition-all hover:border-brand/40 hover:shadow-glow-primary"
            >
              <Mail className="h-4 w-4 text-brand" />
              Sign up with email
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-3"
          >
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-[15px] font-semibold text-text-primary shadow-soft outline-none placeholder:font-normal placeholder:text-text-secondary/60 focus:border-brand focus:shadow-glow-primary"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 chars)"
                className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-[15px] font-semibold text-text-primary shadow-soft outline-none placeholder:font-normal placeholder:text-text-secondary/60 focus:border-brand focus:shadow-glow-primary"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!canSubmitEmail}
              onClick={onNext}
              animate={{ opacity: canSubmitEmail ? 1 : 0.4 }}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-primary px-6 py-4 shadow-glow-primary disabled:cursor-not-allowed"
            >
              <span className="relative flex items-center justify-center gap-2 text-[16px] font-semibold text-white">
                Create account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </motion.button>

            <button
              onClick={() => setMode("choose")}
              className="mx-auto flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to options
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[10px] leading-[1.5] text-text-secondary">
        By continuing you agree to SenecaEdge's Terms & Privacy.
      </p>
    </div>
  );
}

function SocialButton({
  label,
  onClick,
  icon,
  dark,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-[15px] font-semibold shadow-soft transition-all ${
        dark
          ? "bg-[#0F172A] text-white hover:shadow-card-premium"
          : "border border-border bg-card text-text-primary hover:border-brand/40"
      }`}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M17.05 12.04c-.03-2.83 2.31-4.19 2.42-4.26-1.32-1.93-3.37-2.19-4.1-2.22-1.74-.18-3.4 1.02-4.29 1.02-.89 0-2.25-1-3.7-.97-1.9.03-3.66 1.1-4.64 2.81-1.98 3.43-.51 8.5 1.42 11.28.94 1.36 2.07 2.89 3.55 2.83 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.72.89 1.54-.03 2.51-1.39 3.45-2.76 1.09-1.59 1.54-3.13 1.57-3.21-.04-.02-3.01-1.16-3.04-4.59zM14.36 3.66c.79-.96 1.32-2.29 1.18-3.61-1.14.05-2.52.76-3.34 1.71-.73.85-1.37 2.21-1.2 3.51 1.27.1 2.57-.65 3.36-1.61z" />
    </svg>
  );
}
