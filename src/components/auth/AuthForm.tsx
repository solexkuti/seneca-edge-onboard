// Shared sign-in / sign-up form for the standalone /auth/* pages.
//
// This is the post-onboarding entry surface. SlideAuth (inside onboarding)
// remains the new-user signup. This component handles:
//  - Returning users on /auth/sign-in (mode="signin")
//  - Net-new accounts on /auth/sign-up   (mode="signup")
//
// Both flows route to /hub on success and respect Lovable Cloud's
// publishable key + Google OAuth via the shared auth helpers.

import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  signInWithGoogle,
  signUpOrSignInWithEmail,
  syncProfileFromOnboarding,
} from "@/lib/auth";
import { markOnboardingCompleted } from "@/lib/userState";

type Mode = "signin" | "signup";

const COPY: Record<
  Mode,
  { title: string; subtitle: string; cta: string; switchPrompt: string; switchTo: Mode; switchLabel: string }
> = {
  signin: {
    title: "Welcome back.",
    subtitle: "Pick up where you left off.",
    cta: "Sign in",
    switchPrompt: "Don't have an account?",
    switchTo: "signup",
    switchLabel: "Create one",
  },
  signup: {
    title: "Create your account",
    subtitle: "One step away from your edge.",
    cta: "Create account",
    switchPrompt: "Already have an account?",
    switchTo: "signin",
    switchLabel: "Sign in",
  },
};

export default function AuthForm({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "google" | "email">(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !busy && email.trim().length > 3 && email.includes("@") && password.length >= 6;

  const handleSuccess = async (userId: string) => {
    // For sign-up we mark onboarding complete (user came through onboarding
    // before this page existed — or used the dev panel). For sign-in we
    // also mark it: an existing account by definition has onboarded.
    if (userId) {
      await syncProfileFromOnboarding(userId).catch(() => undefined);
    }
    markOnboardingCompleted();
    navigate({ to: "/hub" });
  };

  const handleEmail = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy("email");

    if (mode === "signin") {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !data.user) {
        setError("That email and password don't match.");
        setBusy(null);
        return;
      }
      await handleSuccess(data.user.id);
      return;
    }

    // signup — reuse the helper which gracefully handles "already exists"
    const res = await signUpOrSignInWithEmail(email.trim(), password);
    if (!res.ok) {
      setError(res.error);
      setBusy(null);
      return;
    }
    await handleSuccess(res.userId);
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy("google");
    const res = await signInWithGoogle();
    if (!res.ok) {
      setError(res.error);
      setBusy(null);
      return;
    }
    if (res.userId) await handleSuccess(res.userId);
    setBusy(null);
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-5">
      {/* Ambient gold glow — matches onboarding/SlideAuth */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(198,161,91,0.16),transparent_65%)] blur-2xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-[rgba(198,161,91,0.30)] bg-[rgba(198,161,91,0.08)] px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              Seneca Edge
            </span>
          </div>
          <h1 className="mt-3 font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-text-primary">
            {copy.title}
          </h1>
          <p className="mt-2 text-[14px] text-text-secondary">{copy.subtitle}</p>
        </div>

        <div className="card-premium rounded-3xl p-5 sm:p-6 space-y-3">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={!!busy}
            className="focus-glow flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-6 py-4 text-[15px] font-semibold text-text-primary backdrop-blur-md transition-colors hover:border-[rgba(198,161,91,0.35)] disabled:opacity-60"
          >
            {busy === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <div className="my-2 flex items-center gap-3">
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/80">
              or
            </span>
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
            <input
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
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEmail();
              }}
              placeholder={mode === "signup" ? "Create a password" : "Your password"}
              className="focus-glow h-14 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-12 pr-4 text-[15px] font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-secondary/60 transition-colors focus:border-[rgba(198,161,91,0.45)]"
            />
          </div>

          {error && (
            <p className="text-[13px] text-[#E66A6A]" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleEmail}
            disabled={!canSubmit}
            className="btn-gold focus-glow flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[15px] font-semibold text-[#0B0B0D] disabled:opacity-60"
          >
            {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {copy.cta}
          </button>
        </div>

        <p className="mt-5 text-center text-[13px] text-text-secondary">
          {copy.switchPrompt}{" "}
          <Link
            to={copy.switchTo === "signin" ? "/auth/sign-in" : "/auth/sign-up"}
            className="font-semibold text-gold hover:underline"
          >
            {copy.switchLabel}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.2-5.5 4.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.6 14.6 2.6 12 2.6 6.8 2.6 2.7 6.8 2.7 12s4.1 9.4 9.3 9.4c5.4 0 8.9-3.8 8.9-9.1 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
