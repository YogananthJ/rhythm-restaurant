import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { askOpsAssistant, generateShiftSummary } from "@/lib/ai-ops.functions";
import { Card } from "@/components/ui/card";
import { Illustration } from "@/components/Illustration";
import { SplineScene } from "@/components/SplineScene";

import aiIllustration from "@/assets/illus-ai.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Send,
  Sparkles,
  Timer,
  TrendingUp,
  Utensils,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({
    meta: [
      { title: "Ops Copilot — Occupancy" },
      { name: "description", content: "AI operations assistant and today's analytics for your restaurant floor." },
      { property: "og:title", content: "Ops Copilot — Occupancy" },
      { property: "og:description", content: "Ask your restaurant anything — powered by live floor data." },
    ],
  }),
  component: OpsPage,
});

type Order = {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  table_id: string | null;
};
type OrderItem = { order_id: string; name_snapshot: string; quantity: number };

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I 86 next?",
  "Which tickets are running late?",
  "How is tonight tracking vs a normal night?",
  "Recommend a special based on prep times.",
];

function OpsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "I'm your ops copilot. I can see the live floor, menu, and today's orders. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [shift, setShift] = useState<string | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(askOpsAssistant);
  const briefFn = useServerFn(generateShiftSummary);

  async function generateBrief() {
    if (shiftLoading) return;
    setShiftLoading(true);
    try {
      const res = await briefFn();
      setShift(res.summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate brief");
    } finally {
      setShiftLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("ops-analytics")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, load)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // Restore & persist chat history across visits
  useEffect(() => {
    try {
      const raw = localStorage.getItem("occ.copilot.history");
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("occ.copilot.history", JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  async function load() {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [o, i] = await Promise.all([
      supabase.from("orders").select("id,status,total_cents,created_at,table_id").gte("created_at", since),
      supabase.from("order_items").select("order_id,name_snapshot,quantity").gte("created_at", since),
    ]);
    if (o.data) setOrders(o.data as Order[]);
    if (i.data) setItems(i.data as OrderItem[]);
  }

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.total_cents, 0) / 100;
    const count = orders.length;
    const avg = count ? revenue / count : 0;
    const active = orders.filter((o) => ["placed", "preparing", "ready"].includes(o.status)).length;
    const topMap = new Map<string, number>();
    items.forEach((i) => topMap.set(i.name_snapshot, (topMap.get(i.name_snapshot) ?? 0) + i.quantity));
    const top = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { revenue, count, avg, active, top };
  }, [orders, items]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || pending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setPending(true);
    try {
      const res = await ask({ data: { messages: next.filter((m) => m.role !== "assistant" || messages.indexOf(m) > 0).map((m) => ({ role: m.role, content: m.content })) } });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant failed");
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry — I couldn't answer that. Try again." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="relative z-10 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Floor</Link>
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              <Illustration
                src={aiIllustration}
                alt="Illustration of an AI assistant surrounded by restaurant analytics"
                width={1024}
                height={768}
                rounded="rounded-lg"
                className="h-9 w-9 shrink-0"
              />
              <div>
                <div className="text-sm font-semibold leading-none">Ops Copilot</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">AI + live analytics</div>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/insights"><TrendingUp className="mr-1.5 h-4 w-4" /> Insights</Link>
          </Button>
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3 text-accent" /> Powered by Lovable AI
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-3">
        {/* Analytics */}
        <section className="space-y-6 lg:col-span-1">
          <Card className="relative overflow-hidden border-white/10 bg-card/70 p-4 backdrop-blur">
            <SplineScene
              scene="https://prod.spline.design/zRA8HGnFLAj5zWd5/scene.splinecode"
              label="Animated 3D illustration of the Occupancy AI copilot"
              lazy={false}
              className="mx-auto h-[220px] w-full rounded-xl sm:h-[260px] lg:h-[280px] animate-[occ-float_6s_ease-in-out_infinite]"
            />
            <div className="mt-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
              Copilot online
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Revenue (24h)" value={`$${stats.revenue.toFixed(2)}`} />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Orders" value={String(stats.count)} />
            <Kpi icon={<Timer className="h-4 w-4" />} label="Active" value={String(stats.active)} />
            <Kpi icon={<Utensils className="h-4 w-4" />} label="Avg ticket" value={`$${stats.avg.toFixed(2)}`} />
          </div>

          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top sellers · 24h</h2>
            <div className="mt-4 space-y-3">
              {stats.top.length === 0 && (
                <p className="text-sm text-muted-foreground">No orders yet in the last 24 hours.</p>
              )}
              {stats.top.map(([name, qty], idx) => {
                const max = stats.top[0]?.[1] ?? 1;
                const pct = Math.max(6, Math.round((qty / max) * 100));
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded bg-primary/15 text-[10px] font-semibold text-primary">
                          {idx + 1}
                        </span>
                        {name}
                      </span>
                      <span className="text-muted-foreground">×{qty}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shift brief</h2>
                <p className="mt-1 text-xs text-muted-foreground">AI-written handoff for the next manager.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void generateBrief()} disabled={shiftLoading}>
                <FileText className="mr-1.5 h-3.5 w-3.5" /> {shiftLoading ? "Writing…" : shift ? "Regenerate" : "Generate"}
              </Button>
            </div>
            {shift && (
              <div className="mt-4 whitespace-pre-wrap rounded-lg border border-white/10 bg-background/40 p-4 text-sm leading-relaxed">
                {shift}
              </div>
            )}
          </Card>
        </section>

        {/* Chat */}
        <Card className="flex h-[70vh] flex-col border-white/10 bg-card/70 backdrop-blur lg:col-span-2">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-lg font-semibold">Ask your restaurant</h2>
            <p className="text-xs text-muted-foreground">The copilot reads live tables, menu availability, and open tickets.</p>
          </div>
          <div ref={scrollRef} className="relative flex-1 space-y-4 overflow-y-auto p-5">


            {messages.map((m, i) => (
              <div key={i} className={`rise-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-white/10 bg-background/60"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="rise-in flex items-center gap-2 rounded-2xl border border-white/10 bg-background/60 px-4 py-2.5 text-sm text-muted-foreground">
                  <span className="animate-pulse">Thinking…</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-white/10 p-4">
            {messages.length <= 1 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border border-white/10 bg-background/60 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about waits, 86 candidates, tonight's numbers…"
                className="border-white/10 bg-background/60"
                disabled={pending}
              />
              <Button type="submit" disabled={pending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-card/70 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}
