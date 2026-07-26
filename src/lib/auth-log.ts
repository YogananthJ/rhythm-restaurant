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
  email?: string | null; // masked (e.g. "j***@e***.com") — never raw PII
  emailHash?: string; // short stable hash for correlating events per user
  detail?: string;
};

// Mask an email so the local part and domain label are reduced to their first
// character + asterisks, preserving the TLD. Never store the raw address.
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const maskedLocal =
    local.length <= 1 ? "*" : `${local[0]}${"*".repeat(Math.max(1, local.length - 1))}`;
  const dot = domain.lastIndexOf(".");
  if (dot < 1) return `${maskedLocal}@***`;
  const host = domain.slice(0, dot);
  const tld = domain.slice(dot); // includes leading dot
  const maskedHost =
    host.length <= 1 ? "*" : `${host[0]}${"*".repeat(Math.max(1, host.length - 1))}`;
  return `${maskedLocal}@${maskedHost}${tld}`;
}

// Short, stable, non-cryptographic hash. Enough to correlate events for the
// same user within a session without storing the address itself.
function shortHash(input: string): string {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

function scrubDetail(detail: string | undefined): string | undefined {
  if (!detail) return detail;
  return detail.replace(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    (m) => maskEmail(m) ?? "***",
  );
}

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
