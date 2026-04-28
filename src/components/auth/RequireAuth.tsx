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
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md px-6"
      >
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/90 p-6 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Sign in to continue
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for signed-in members. Sign in or create an account to
            access your journal, mentor, and strategy tools.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.99]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
