// Gate for protected routes.
// - Loading: shows nothing (avoids flash of unauthenticated content)
// - Authenticated: renders children
// - Unauthenticated: blocking overlay with "Sign in to continue"
//   The protected page is dimmed behind the overlay and pointer events are
//   disabled so no interaction can leak through.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Lock } from "lucide-react";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (status === "authenticated") {
    return <>{children}</>;
  }

  // Unauthenticated — render the page non-interactively behind a blocking overlay.
  return (
    <div className="relative min-h-[100svh]">
      <div
        aria-hidden
        className="pointer-events-none select-none opacity-30 blur-[2px]"
      >
        {children}
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in required"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0D]/70 backdrop-blur-md px-6"
      >
        {/* Warm ambient glow behind the card */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(198,161,91,0.18),transparent_65%)] blur-2xl"
        />
        <div className="card-premium relative w-full max-w-sm rounded-3xl p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(198,161,91,0.10)] ring-1 ring-[rgba(198,161,91,0.30)]">
            <Lock className="h-5 w-5 text-gold" aria-hidden />
          </div>
          <h2 className="mt-4 font-display text-[20px] font-semibold tracking-tight text-text-primary">
            Sign in to continue
          </h2>
          <p className="mt-2 text-[13.5px] leading-snug text-text-secondary">
            This area is for signed-in members. Sign in or create an account to
            access your journal, mentor, and strategy tools.
          </p>
          <Link
            to="/auth/sign-in"
            className="btn-gold focus-glow mt-5 inline-flex w-full items-center justify-center px-4 py-2.5 text-[14px] font-semibold text-[#0B0B0D]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
