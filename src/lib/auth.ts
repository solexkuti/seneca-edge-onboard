// Authentication + profile sync helpers.
// Wraps Supabase auth with friendly error messages and writes the user's
// onboarding answers to the `profiles` table on successful signup/login.

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { readProfile } from "@/lib/onboardingProfile";
import { getUserName } from "@/lib/userName";

const FRIENDLY_ERROR = "Something went wrong. Try again.";

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/** Map raw Supabase auth errors → calm user-facing copy. */
function friendlyError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : typeof err === "string"
        ? err.toLowerCase()
        : "";

  if (!msg) return FRIENDLY_ERROR;

  if (msg.includes("already registered") || msg.includes("already exists"))
    return "An account with this email already exists. Try signing in.";
  if (msg.includes("invalid login") || msg.includes("invalid credentials"))
    return "That email and password don't match.";
  if (msg.includes("weak password") || msg.includes("password should"))
    return "Please choose a stronger password.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Too many attempts. Wait a moment and try again.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Network issue. Check your connection and try again.";

  return FRIENDLY_ERROR;
}

/**
 * Sign up or sign in with email + password.
 * If a user with the email already exists, we try to sign them in instead —
 * preventing duplicate-account confusion when someone re-runs onboarding.
 */
export async function signUpOrSignInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      },
    );

    if (signUpError) {
      const m = signUpError.message.toLowerCase();
      // Account exists → try to sign in transparently
      if (m.includes("already registered") || m.includes("already exists")) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) return { ok: false, error: friendlyError(signInError) };
        if (!signInData.user) return { ok: false, error: FRIENDLY_ERROR };
        return { ok: true, userId: signInData.user.id };
      }
      return { ok: false, error: friendlyError(signUpError) };
    }

    if (!signUpData.user) return { ok: false, error: FRIENDLY_ERROR };
    return { ok: true, userId: signUpData.user.id };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/**
 * Trigger the Google OAuth flow via Lovable Cloud's managed broker.
 * The browser is redirected — control returns to this app on the same path.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return { ok: false, error: friendlyError(result.error) };
    if (result.redirected) {
      // Browser is leaving — caller never sees the resolution.
      return { ok: true, userId: "" };
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { ok: false, error: FRIENDLY_ERROR };
    return { ok: true, userId: data.user.id };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/**
 * Persist the onboarding answers + chosen username to the user's profile row.
 * Safe to call multiple times — uses upsert.
 */
export async function syncProfileFromOnboarding(
  userId: string,
): Promise<{ ok: boolean }> {
  try {
    const profile = readProfile();
    const username = getUserName();

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          username: username ?? null,
          market: profile.market ?? null,
          experience: profile.experience ?? null,
          challenge: profile.challenge ?? null,
          goal: profile.goal ?? null,
          onboarded_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) {
      // Username collision is the only "expected" failure — retry without it.
      if (error.message.toLowerCase().includes("unique")) {
        await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              market: profile.market ?? null,
              experience: profile.experience ?? null,
              challenge: profile.challenge ?? null,
              goal: profile.goal ?? null,
              onboarded_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
      }
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore — local state will be cleared by caller
  }
}
