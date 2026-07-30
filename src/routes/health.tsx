import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw, ChefHat } from "lucide-react";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Backend status — Occupancy" },
      { name: "description", content: "Live health check for Occupancy backend: auth, database, and realtime." },
      { property: "og:title", content: "Backend status — Occupancy" },
      { property: "og:description", content: "Verify that authentication, database, and realtime services are reachable." },
    ],
  }),
  component: HealthPage,
});

type Status = "checking" | "ok" | "fail";
type Check = { name: string; status: Status; detail?: string; ms?: number };

function HealthPage() {
  const [checks, setChecks] = useState<Check[]>([
    { name: "Authentication", status: "checking" },
    { name: "Database", status: "checking" },
    { name: "Realtime", status: "checking" },
  ]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  async function runChecks() {
    setRunning(true);
    setChecks((cs) => cs.map((c) => ({ ...c, status: "checking" as Status, detail: undefined, ms: undefined })));

    // Auth
    const authStart = performance.now();
    let authResult: Check;
    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      authResult = { name: "Authentication", status: "ok", ms: Math.round(performance.now() - authStart), detail: "Auth service reachable" };
    } catch (e) {
      authResult = { name: "Authentication", status: "fail", detail: e instanceof Error ? e.message : "Unknown error" };
    }

    // DB
    const dbStart = performance.now();
    let dbResult: Check;
    try {
      const { error } = await supabase.from("restaurants").select("id").limit(1);
      if (error) throw error;
      dbResult = { name: "Database", status: "ok", ms: Math.round(performance.now() - dbStart), detail: "Query returned successfully" };
    } catch (e) {
      dbResult = { name: "Database", status: "fail", detail: e instanceof Error ? e.message : "Unknown error" };
    }

    // Realtime
    const rtStart = performance.now();
    const rtResult: Check = await new Promise((resolve) => {
      const channel = supabase.channel(`health-${Math.random().toString(36).slice(2)}`);
      let done = false;
      const finish = (result: Check) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        // Defer removal so we don't recurse into the subscribe callback via onClose.
        setTimeout(() => { try { supabase.removeChannel(channel); } catch { /* noop */ } }, 0);
        resolve(result);
      };
      const timer = setTimeout(() => {
        finish({ name: "Realtime", status: "fail", detail: "Timed out after 5s" });
      }, 5000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          finish({ name: "Realtime", status: "ok", ms: Math.round(performance.now() - rtStart), detail: "Websocket connected" });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          finish({ name: "Realtime", status: "fail", detail: `Channel status: ${status}` });
        }
      });
    });

    setChecks([authResult, dbResult, rtResult]);
    setLastRun(new Date());
    setRunning(false);
  }

  useEffect(() => {
    runChecks();
  }, []);

  const allOk = checks.every((c) => c.status === "ok");
  const anyFail = checks.some((c) => c.status === "fail");

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link to="/" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChefHat className="h-4 w-4 text-primary" /> Occupancy
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Backend status</h1>
          <Button size="sm" variant="outline" onClick={runChecks} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Re-run
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Live check of auth, database, and realtime services.
        </p>

        <div className={`mt-6 rounded-xl border p-4 ${
          running ? "border-white/10 bg-card/60" :
          allOk ? "border-emerald-500/30 bg-emerald-500/10" :
          anyFail ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-card/60"
        }`}>
          <div className="text-sm font-medium">
            {running ? "Running checks…" : allOk ? "All systems operational" : anyFail ? "One or more services unreachable" : "Checking…"}
          </div>
          {lastRun && <div className="mt-1 text-xs text-muted-foreground">Last checked {lastRun.toLocaleTimeString()}</div>}
        </div>

        <div className="mt-4 space-y-3">
          {checks.map((c) => (
            <Card key={c.name} className="flex items-start justify-between gap-4 border-white/10 bg-card/80 p-4">
              <div className="flex items-start gap-3">
                {c.status === "checking" ? (
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-muted-foreground" />
                ) : c.status === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 text-red-400" />
                )}
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.status === "checking" ? "Contacting service…" : c.detail}
                  </div>
                </div>
              </div>
              {typeof c.ms === "number" && (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {c.ms} ms
                </span>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="hover:text-foreground">← Back to sign in</Link>
        </div>
      </main>
    </div>
  );
}
