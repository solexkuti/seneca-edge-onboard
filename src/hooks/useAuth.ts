// Reactive auth state for the client.
// CRITICAL: subscribe to onAuthStateChange BEFORE calling getSession so we
// don't miss events restored from localStorage.

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: User | null;
  session: Session | null;
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    session: null,
  });

  useEffect(() => {
    let mounted = true;

    const apply = (session: Session | null) => {
      if (!mounted) return;
      setState((prev) => {
        const nextStatus: AuthState["status"] = session?.user
          ? "authenticated"
          : "unauthenticated";
        const nextUserId = session?.user?.id ?? null;
        const prevUserId = prev.user?.id ?? null;
        // Skip updates that don't change identity or auth status. Supabase
        // fires onAuthStateChange very frequently (TOKEN_REFRESHED on focus,
        // INITIAL_SESSION on tab restore, USER_UPDATED, etc.). Returning the
        // same state reference avoids cascading re-renders in consumers like
        // RequireAuth that wrap mid-interaction flows (e.g. journal entry).
        if (prev.status === nextStatus && prevUserId === nextUserId) {
          return prev;
        }
        return { status: nextStatus, user: session?.user ?? null, session };
      });
    };

    // 1) Subscribe FIRST so we catch the initial SIGNED_IN event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session ?? null);
    });

    // 2) Then fetch any persisted session.
    supabase.auth.getSession().then(({ data }) => {
      apply(data.session ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
