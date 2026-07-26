import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Single in-module cache so every component sees the same session snapshot
// immediately (no per-mount getSession() flicker) and updates together when
// onAuthStateChange fires.
type AuthSnapshot = {
  status: "loading" | "authenticated" | "unauthenticated";
  session: Session | null;
  user: User | null;
};

let snapshot: AuthSnapshot = { status: "loading", session: null, user: null };
const listeners = new Set<(s: AuthSnapshot) => void>();
let initialized = false;

// Tracks whether the most recent sign-out was user-initiated. When true, a
// subsequent SIGNED_OUT event is silent; when false, the root listener treats
// it as an expired session and prompts re-authentication.
let intentionalSignOut = false;

export function markIntentionalSignOut() {
  intentionalSignOut = true;
}
export function consumeIntentionalSignOut(): boolean {
  const v = intentionalSignOut;
  intentionalSignOut = false;
  return v;
}

function setSnapshot(next: AuthSnapshot) {
  snapshot = next;
  for (const l of listeners) l(next);
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  supabase.auth.getSession().then(({ data }) => {
    setSnapshot({
      status: data.session ? "authenticated" : "unauthenticated",
      session: data.session ?? null,
      user: data.session?.user ?? null,
    });
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    setSnapshot({
      status: session ? "authenticated" : "unauthenticated",
      session: session ?? null,
      user: session?.user ?? null,
    });
  });
}

export function useAuth(): AuthSnapshot {
  const [local, setLocal] = useState<AuthSnapshot>(() => {
    ensureInitialized();
    return snapshot;
  });
  useEffect(() => {
    ensureInitialized();
    if (local !== snapshot) setLocal(snapshot);
    const l = (s: AuthSnapshot) => setLocal(s);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return local;
}

export async function signOutEverywhere() {
  markIntentionalSignOut();
  await supabase.auth.signOut();
}

// Message shapes returned by Supabase / PostgREST when the JWT is no longer
// valid. Kept broad so any surface can pipe an error through isAuthExpiredError
// without introspecting HTTP status codes.
const EXPIRED_HINTS = [
  "jwt expired",
  "invalid jwt",
  "jwt malformed",
  "token is expired",
  "refresh_token_not_found",
  "invalid refresh token",
  "session_not_found",
  "session from session_id claim in jwt does not exist",
];

export function isAuthExpiredError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { status?: number; code?: string; message?: string };
  if (anyErr.status === 401) return true;
  const msg = (anyErr.message ?? String(err)).toLowerCase();
  return EXPIRED_HINTS.some((h) => msg.includes(h));
}

// Force a client-side session teardown after a detected expiry. Safe to call
// from any component/hook; the root listener will surface the toast + redirect.
export async function handleExpiredSession() {
  // Do NOT mark intentional — we want the "session expired" UX to fire.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore — listener still fires from local state clear
  }
}
