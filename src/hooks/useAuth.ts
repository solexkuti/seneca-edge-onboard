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

    // 1) Subscribe FIRST so we catch the initial SIGNED_IN event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({
        status: session?.user ? "authenticated" : "unauthenticated",
        user: session?.user ?? null,
        session: session ?? null,
      });
    });

    // 2) Then fetch any persisted session.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({
        status: data.session?.user ? "authenticated" : "unauthenticated",
        user: data.session?.user ?? null,
        session: data.session ?? null,
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
