// Structured in-memory log of auth lifecycle events for QA/debug.
// Keeps the last N events and notifies subscribers so a debug panel can render
// live. Also mirrors to console.info with a stable tag so log scrapers /
// Playwright tests can assert against it.

export type AuthLogKind =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "AUTH_EXPIRED"
  | "INTENTIONAL_SIGN_OUT"
  | "INITIAL_SESSION";

export type AuthLogEntry = {
  id: string;
  kind: AuthLogKind;
  at: number; // epoch ms
  email?: string | null;
  detail?: string;
};

const MAX = 100;
const TAG = "[auth-log]";
const STORAGE_KEY = "occupancy.authLog.v1";

let entries: AuthLogEntry[] = [];
const listeners = new Set<(e: AuthLogEntry[]) => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota */
  }
}

function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) entries = JSON.parse(raw) as AuthLogEntry[];
  } catch {
    /* ignore */
  }
}
hydrate();

export function logAuthEvent(kind: AuthLogKind, opts: { email?: string | null; detail?: string } = {}) {
  const entry: AuthLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    at: Date.now(),
    email: opts.email ?? null,
    detail: opts.detail,
  };
  entries = [entry, ...entries].slice(0, MAX);
  persist();
  // eslint-disable-next-line no-console
  console.info(`${TAG} ${kind}`, {
    at: new Date(entry.at).toISOString(),
    email: entry.email,
    detail: entry.detail,
  });
  for (const l of listeners) l(entries);
  // Expose to window for Playwright/QA assertions.
  if (typeof window !== "undefined") {
    (window as unknown as { __authLog?: AuthLogEntry[] }).__authLog = entries;
  }
}

export function getAuthLog(): AuthLogEntry[] {
  return entries;
}

export function subscribeAuthLog(fn: (e: AuthLogEntry[]) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function clearAuthLog() {
  entries = [];
  persist();
  for (const l of listeners) l(entries);
}
