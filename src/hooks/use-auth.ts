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

function setSnapshot(next: AuthSnapshot) {
  snapshot = next;
  for (const l of listeners) l(next);
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  // Hydrate from persisted session (localStorage) — synchronous read against
  // the SDK's cache; getSession() itself is async but resolves immediately
  // when a session is already in storage.
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
    // Sync immediately in case snapshot changed between render and effect.
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
  await supabase.auth.signOut();
}
