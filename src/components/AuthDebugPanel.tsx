import { useEffect, useState } from "react";
import { Bug, X, Trash2 } from "lucide-react";

import {
  type AuthLogEntry,
  clearAuthLog,
  getAuthLog,
  subscribeAuthLog,
} from "@/lib/auth-log";

const KIND_COLORS: Record<string, string> = {
  SIGNED_IN: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  SIGNED_OUT: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  AUTH_EXPIRED: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  TOKEN_REFRESHED: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  USER_UPDATED: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  INITIAL_SESSION: "text-muted-foreground bg-muted/40 border-border",
  INTENTIONAL_SIGN_OUT: "text-muted-foreground bg-muted/40 border-border",
};

function isEnabledByFlag(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  try {
    if (window.localStorage.getItem("occupancy.debug.auth") === "1") return true;
    if (new URLSearchParams(window.location.search).get("debug") === "auth") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function AuthDebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuthLogEntry[]>([]);

  useEffect(() => {
    setEnabled(isEnabledByFlag());
    setEntries(getAuthLog());
    const unsub = subscribeAuthLog(setEntries);
    return unsub;
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[100] print:hidden" data-testid="auth-debug-panel">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur hover:bg-background"
          data-testid="auth-debug-open"
        >
          <Bug className="h-3.5 w-3.5" />
          Auth log
          <span className="rounded-full bg-primary/20 px-1.5 text-[10px] text-primary">
            {entries.length}
          </span>
        </button>
      ) : (
        <div className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-background/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Bug className="h-3.5 w-3.5" />
              Auth event log
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearAuthLog}
                title="Clear log"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <ul
            className="max-h-72 overflow-y-auto divide-y divide-border text-xs"
            data-testid="auth-debug-list"
          >
            {entries.length === 0 && (
              <li className="p-3 text-muted-foreground">No auth events yet.</li>
            )}
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-2 px-3 py-2" data-auth-kind={e.kind}>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                    KIND_COLORS[e.kind] ?? "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {e.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">
                    {e.email ?? "—"}
                    {e.emailHash && (
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                        #{e.emailHash}
                      </span>
                    )}
                  </div>
                  {e.detail && (
                    <div className="truncate text-muted-foreground">{e.detail}</div>
                  )}
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {new Date(e.at).toISOString().slice(11, 23)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            Toggle with <code>localStorage.occupancy.debug.auth = "1"</code> or{" "}
            <code>?debug=auth</code>
          </div>
        </div>
      )}
    </div>
  );
}
