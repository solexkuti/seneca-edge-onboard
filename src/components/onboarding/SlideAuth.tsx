import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";
import {
  signInWithGoogle,
  signUpOrSignInWithEmail,
  syncProfileFromOnboarding,
} from "@/lib/auth";

type Props = SlideProps & {
  username?: string;
  /** Called when authentication succeeds and profile has been synced. */
  onAuthed: () => void;
};

export default function SlideAuth({ username, onAuthed }: Props) {
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "google" | "email">(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmitEmail =
    !busy &&
    email.trim().length > 3 &&
    email.includes("@") &&
    password.length >= 6;

  const handleGoogle = async () => {
    setError(null);
    setBusy("google");
    const res = await signInWithGoogle();
    if (!res.ok) {
      setError(res.error);
      setBusy(null);
      return;
    }
    // If browser was redirected, we never reach here.
    if (res.userId) await syncProfileFromOnboarding(res.userId);
    setBusy(null);
    onAuthed();
  };

  const handleEmail = async () => {
    if (!canSubmitEmail) return;
    setError(null);
    setBusy("email");
    const res = await signUpOrSignInWithEmail(email.trim(), password);
    if (!res.ok) {
      setError(res.error);
      setBusy(null);
      return;
    }
    await syncProfileFromOnboarding(res.userId);
    setBusy(null);
    onAuthed();
  };

  return (
    <div className="relative flex flex-col gap-6">
      {/* Warm ambient glow behind the auth card — matches global background system */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-16 -bottom-10 -z-10"
      >
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(198,161,91,0.18),transparent_65%)] blur-2xl" />
        <div className="absolute right-0 bottom-0 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(230,194,122,0.10),transparent_70%)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-[rgba(198,161,91,0.30)] bg-[rgba(198,161,91,0.08)] px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            One last step
          </span>
        </div>
        <h1 className="mt-3 font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-text-primary">
          Everything is <span className="text-gold-soft">ready.</span>
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

      {/* Glass auth card — same surface treatment as dashboard cards */}
      <div className="card-premium rounded-3xl p-5 sm:p-6">
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
                onClick={handleGoogle}
                icon={<GoogleIcon />}
                loading={busy === "google"}
                disabled={!!busy}
              />

              <div className="my-2 flex items-center gap-3">
                <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/80">
                  or
                </span>
                <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setError(null);
                  setMode("email");
                }}
                disabled={!!busy}
                className="focus-glow flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-6 py-4 text-[15px] font-semibold text-text-primary backdrop-blur-md transition-colors hover:border-[rgba(198,161,91,0.35)] disabled:opacity-60"
              >
                <Mail className="h-4 w-4 text-gold" />
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
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="focus-glow h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-12 pr-4 text-[15px] font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-secondary/60 transition-colors focus:border-[rgba(198,161,91,0.45)]"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEmail();
                  }}
                  placeholder="Password (min 6 chars)"
                  className="focus-glow h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-12 pr-4 text-[15px] font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-secondary/60 transition-colors focus:border-[rgba(198,161,91,0.45)]"
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!canSubmitEmail}
                onClick={handleEmail}
                animate={{ opacity: canSubmitEmail ? 1 : 0.45 }}
                className="btn-gold focus-glow group relative w-full overflow-hidden px-6 py-4 disabled:cursor-not-allowed"
              >
                <span className="relative flex items-center justify-center gap-2 text-[16px] font-semibold text-[#0B0B0D]">
                  {busy === "email" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </motion.button>

              <button
                onClick={() => setMode("choose")}
                disabled={!!busy}
                className="mx-auto flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary hover:text-gold-soft disabled:opacity-50"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to options
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              role="alert"
              className="mt-3 rounded-xl border border-[rgba(166,102,102,0.35)] bg-[rgba(166,102,102,0.08)] px-4 py-2.5 text-center text-[12.5px] font-medium text-[#D9A3A3]"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-[10.5px] leading-[1.5] text-text-secondary/80">
        By continuing you agree to SenecaEdge's Terms & Privacy.
      </p>
    </div>
  );
}

function SocialButton({
  label,
  onClick,
  icon,
  loading,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  dark?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      onClick={onClick}
      disabled={disabled}
      className="focus-glow flex w-full items-center justify-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.035)] px-6 py-4 text-[15px] font-semibold text-text-primary backdrop-blur-md transition-colors hover:border-[rgba(198,161,91,0.35)] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-gold" /> : icon}
      {loading ? "Connecting…" : label}
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
