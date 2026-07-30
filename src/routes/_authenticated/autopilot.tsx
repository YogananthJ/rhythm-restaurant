import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  ChefHat,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Gauge,
  Radar,
  Rocket,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import {
  generateAutopilotPlan,
  type AutopilotAction,
  type AutopilotResponse,
  type RiskPrediction,
} from "@/lib/autopilot.functions";

type Order = { id: string; status: string; total_cents: number; created_at: string; updated_at: string; table_id: string | null; guest_name: string | null; restaurant_id: string };
type OrderItem = { id: string; order_id: string; name_snapshot: string; quantity: number; status: string; unit_price_cents: number; menu_item_id: string; created_at: string };
type DiningTable = { id: string; label: string; seats: number; status: string; restaurant_id: string };
type MenuItem = { id: string; name: string; is_available: boolean; prep_minutes: number; price_cents: number; restaurant_id: string };
type WaitEntry = { id: string; guest_name: string; party_size: number; status: string; quoted_minutes: number; created_at: string; seated_table_id: string | null };
type Feedback = { id: string; rating: number; sentiment: string | null; created_at: string };

const ACTIVE = new Set(["placed", "preparing", "ready"]);

export const Route = createFileRoute("/_authenticated/autopilot")({
  head: () => ({
    meta: [
      { title: "Autopilot — Occupancy" },
      { name: "description", content: "AI Restaurant Operating System — live action cards, risk predictions, explainable health score, and digital twin simulator." },
      { property: "og:title", content: "Restaurant Autopilot — Occupancy" },
      { property: "og:description", content: "Tesla Autopilot for restaurants: proactive AI recommendations from live floor data." },
    ],
  }),
  component: AutopilotPage,
});

// ────────────────────────────────────────────────────────────────
// Health score: explainable, deterministic
// ────────────────────────────────────────────────────────────────
type HealthBreakdown = {
  score: number;
  contributions: { label: string; delta: number; detail: string }[];
};

function computeHealth(input: {
  activeOrders: Order[];
  items: OrderItem[];
  tables: DiningTable[];
  menu: MenuItem[];
  waitlist: WaitEntry[];
  feedback: Feedback[];
  revenue24h: number;
}): HealthBreakdown {
  const contributions: HealthBreakdown["contributions"] = [];
  let score = 100;

  // Kitchen load
  const backlog = input.items.filter((i) => i.status !== "served").length;
  const kitchenPenalty = Math.min(30, Math.max(0, backlog - 4) * 3);
  if (kitchenPenalty > 0) contributions.push({ label: "Kitchen Load", delta: -kitchenPenalty, detail: `${backlog} items in queue` });
  else contributions.push({ label: "Kitchen Load", delta: +5, detail: `${backlog} items in queue` });
  score -= kitchenPenalty;
  if (kitchenPenalty === 0) score += 5;

  // Waitlist pressure
  const waiting = input.waitlist.filter((w) => w.status === "waiting").length;
  const waitPenalty = Math.min(20, waiting * 3);
  if (waitPenalty > 0) contributions.push({ label: "Queue", delta: -waitPenalty, detail: `${waiting} parties waiting` });
  else contributions.push({ label: "Queue", delta: +4, detail: "No queue" });
  score -= waitPenalty;
  if (waitPenalty === 0) score += 4;

  // Occupancy sweet spot 60-85%
  const seated = input.tables.filter((t) => t.status === "seated").length;
  const occ = input.tables.length ? seated / input.tables.length : 0;
  let occDelta = 0;
  if (occ < 0.3) occDelta = -8;
  else if (occ > 0.9) occDelta = -6;
  else occDelta = +8;
  contributions.push({ label: "Occupancy", delta: occDelta, detail: `${Math.round(occ * 100)}% seated` });
  score += occDelta;

  // Menu availability
  const unavail = input.menu.filter((m) => !m.is_available).length;
  const menuPenalty = Math.min(15, unavail * 2);
  if (menuPenalty > 0) contributions.push({ label: "Menu Coverage", delta: -menuPenalty, detail: `${unavail} items 86'd` });
  else contributions.push({ label: "Menu Coverage", delta: +3, detail: "Full menu live" });
  score -= menuPenalty;
  if (menuPenalty === 0) score += 3;

  // Ticket age (any order > 25 min still open)
  const now = Date.now();
  const stale = input.activeOrders.filter((o) => (now - new Date(o.created_at).getTime()) / 60000 > 25).length;
  const stalePenalty = Math.min(15, stale * 5);
  if (stalePenalty > 0) contributions.push({ label: "Ticket Age", delta: -stalePenalty, detail: `${stale} tickets > 25m` });
  else contributions.push({ label: "Ticket Age", delta: +4, detail: "Tickets fresh" });
  score -= stalePenalty;
  if (stalePenalty === 0) score += 4;

  // Guest sentiment
  if (input.feedback.length) {
    const avg = input.feedback.reduce((s, f) => s + f.rating, 0) / input.feedback.length;
    const delta = Math.round((avg - 3) * 4); // -8..+8
    contributions.push({ label: "Guest Satisfaction", delta, detail: `${avg.toFixed(1)}★ over ${input.feedback.length}` });
    score += delta;
  } else {
    contributions.push({ label: "Guest Satisfaction", delta: 0, detail: "No feedback yet" });
  }

  // Revenue heartbeat
  const revDelta = input.revenue24h > 500 ? +6 : input.revenue24h > 100 ? +3 : 0;
  contributions.push({ label: "Revenue", delta: revDelta, detail: `$${input.revenue24h.toFixed(0)} / 24h` });
  score += revDelta;

  return { score: Math.max(0, Math.min(100, Math.round(score))), contributions };
}

// ────────────────────────────────────────────────────────────────
// Judge Mode — spawns realistic orders into supabase
// ────────────────────────────────────────────────────────────────
async function judgeTick(restaurantId: string, tables: DiningTable[], menu: MenuItem[]) {
  const available = menu.filter((m) => m.is_available);
  if (available.length === 0 || tables.length === 0) return;
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const roll = Math.random();

  if (roll < 0.55) {
    // Create an order with 1-3 items
    const table = pick(tables);
    const chosen = new Set<string>();
    const count = 1 + Math.floor(Math.random() * 3);
    while (chosen.size < count) chosen.add(pick(available).id);
    const chosenItems = available.filter((m) => chosen.has(m.id));
    const total = chosenItems.reduce((s, m) => s + m.price_cents, 0);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: table.id,
        guest_name: pick(["Alex", "Priya", "Jordan", "Riya", "Sam", "Noor", "Kai", "Mia"]),
        total_cents: total,
        status: "placed",
      })
      .select("id")
      .single();
    if (error || !order) return;
    await supabase.from("order_items").insert(
      chosenItems.map((m) => ({
        order_id: order.id,
        menu_item_id: m.id,
        name_snapshot: m.name,
        unit_price_cents: m.price_cents,
        quantity: 1,
        status: "queued",
      })),
    );
  } else if (roll < 0.8) {
    // Advance an existing order
    const { data: openOrders } = await supabase.from("orders").select("id,status").in("status", ["placed", "preparing", "ready"]).limit(5);
    if (openOrders && openOrders.length) {
      const o = pick(openOrders);
      const next = o.status === "placed" ? "preparing" : o.status === "preparing" ? "ready" : "served";
      await supabase.from("orders").update({ status: next }).eq("id", o.id);
    }
  } else {
    // Cycle a random table
    const t = pick(tables);
    const nextStatus = t.status === "seated" ? "cleaning" : t.status === "cleaning" ? "free" : "seated";
    await supabase.from("dining_tables").update({ status: nextStatus }).eq("id", t.id);
  }
}

function AutopilotPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitEntry[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [plan, setPlan] = useState<AutopilotResponse | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [autoPilot, setAutoPilot] = useState(true);
  const [judgeMode, setJudgeMode] = useState(false);
  const [lastRun, setLastRun] = useState<number>(0);
  const runPlan = useServerFn(generateAutopilotPlan);
  const planTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const judgeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [o, i, t, m, w, f] = await Promise.all([
      supabase.from("orders").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("order_items").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("dining_tables").select("*").order("label"),
      supabase.from("menu_items").select("*").order("name"),
      supabase.from("waitlist").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("guest_feedback").select("*").gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    if (o.data) setOrders(o.data as Order[]);
    if (i.data) setItems(i.data as OrderItem[]);
    if (t.data) setTables(t.data as DiningTable[]);
    if (m.data) setMenu(m.data as MenuItem[]);
    if (w.data) setWaitlist(w.data as WaitEntry[]);
    if (f.data) setFeedback(f.data as Feedback[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("restaurants").select("id").limit(1).maybeSingle();
      if (data?.id) setRestaurantId(data.id);
    })();
    void loadAll();
    const ch = supabase
      .channel("autopilot-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_feedback" }, loadAll)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [loadAll]);

  // Derived state
  const activeOrders = useMemo(() => orders.filter((o) => ACTIVE.has(o.status)), [orders]);
  const revenue24h = useMemo(() => orders.reduce((s, o) => s + o.total_cents, 0) / 100, [orders]);
  const health = useMemo(
    () => computeHealth({ activeOrders, items, tables, menu, waitlist, feedback, revenue24h }),
    [activeOrders, items, tables, menu, waitlist, feedback, revenue24h],
  );

  const emergency = health.score < 50;

  const snapshot = useMemo(() => {
    const now = Date.now();
    return {
      generated_at: new Date().toISOString(),
      health_score: health.score,
      health_breakdown: health.contributions,
      tables: tables.map((t) => ({ label: t.label, status: t.status, seats: t.seats })),
      menu: menu.map((m) => ({ name: m.name, available: m.is_available, prep_minutes: m.prep_minutes, price: m.price_cents / 100 })),
      waitlist: waitlist.filter((w) => w.status === "waiting").map((w) => ({ guest_name: w.guest_name, party_size: w.party_size, waiting_minutes: Math.round((now - new Date(w.created_at).getTime()) / 60000) })),
      active_orders: activeOrders.map((o) => ({
        order_prefix: o.id.slice(0, 6),
        status: o.status,
        table: tables.find((t) => t.id === o.table_id)?.label ?? null,
        total: o.total_cents / 100,
        minutes_open: Math.round((now - new Date(o.created_at).getTime()) / 60000),
        items: items.filter((it) => it.order_id === o.id).map((it) => ({ name: it.name_snapshot, qty: it.quantity, status: it.status })),
      })),
      revenue_24h: revenue24h,
      orders_24h: orders.length,
      guest_feedback_24h: {
        count: feedback.length,
        avg_rating: feedback.length ? +(feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(2) : null,
      },
    };
  }, [health, tables, menu, waitlist, activeOrders, items, orders.length, feedback, revenue24h]);

  const requestPlan = useCallback(async () => {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const res = await runPlan({ data: { snapshot } });
      setPlan(res);
      setLastRun(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Autopilot request failed";
      toast.error(msg);
    } finally {
      setPlanBusy(false);
    }
  }, [runPlan, snapshot, planBusy]);

  // Auto-run every 45s while autopilot on
  useEffect(() => {
    if (!autoPilot) {
      if (planTimer.current) clearInterval(planTimer.current);
      return;
    }
    void requestPlan();
    planTimer.current = setInterval(() => { void requestPlan(); }, 45_000);
    return () => { if (planTimer.current) clearInterval(planTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPilot]);

  // Judge Mode ticker
  useEffect(() => {
    if (!judgeMode || !restaurantId) {
      if (judgeTimer.current) clearInterval(judgeTimer.current);
      return;
    }
    judgeTimer.current = setInterval(() => { void judgeTick(restaurantId, tables, menu); }, 7000);
    return () => { if (judgeTimer.current) clearInterval(judgeTimer.current); };
  }, [judgeMode, restaurantId, tables, menu]);

  const approveAction = useCallback(async (a: AutopilotAction) => {
    try {
      switch (a.action.kind) {
        case "eighty_six_item": {
          const target = menu.find((m) => m.name.toLowerCase() === (a.action.item_name ?? "").toLowerCase());
          if (!target) throw new Error(`Menu item not found: ${a.action.item_name}`);
          const { error } = await supabase.from("menu_items").update({ is_available: false }).eq("id", target.id);
          if (error) throw error;
          toast.success(`86'd ${target.name}`);
          break;
        }
        case "unhide_item": {
          const target = menu.find((m) => m.name.toLowerCase() === (a.action.item_name ?? "").toLowerCase());
          if (!target) throw new Error(`Menu item not found: ${a.action.item_name}`);
          const { error } = await supabase.from("menu_items").update({ is_available: true }).eq("id", target.id);
          if (error) throw error;
          toast.success(`Re-enabled ${target.name}`);
          break;
        }
        case "mark_table_cleaning": {
          const target = tables.find((t) => t.label.toLowerCase() === (a.action.table_label ?? "").toLowerCase());
          if (!target) throw new Error(`Table not found: ${a.action.table_label}`);
          const { error } = await supabase.from("dining_tables").update({ status: "cleaning" }).eq("id", target.id);
          if (error) throw error;
          toast.success(`${target.label} → cleaning`);
          break;
        }
        case "seat_waitlist": {
          const guest = waitlist.find((w) => w.status === "waiting" && w.guest_name.toLowerCase() === (a.action.guest_name ?? "").toLowerCase());
          if (!guest) throw new Error(`Guest not on waitlist: ${a.action.guest_name}`);
          const table = a.action.table_label
            ? tables.find((t) => t.label.toLowerCase() === a.action.table_label!.toLowerCase())
            : tables.find((t) => t.status === "free" && t.seats >= guest.party_size);
          if (!table) throw new Error("No suitable table available");
          const [{ error: e1 }, { error: e2 }] = await Promise.all([
            supabase.from("waitlist").update({ status: "seated", seated_table_id: table.id }).eq("id", guest.id),
            supabase.from("dining_tables").update({ status: "seated" }).eq("id", table.id),
          ]);
          if (e1 || e2) throw e1 ?? e2;
          toast.success(`Seated ${guest.guest_name} at ${table.label}`);
          break;
        }
        case "notify_guest": {
          toast.success(`Notified ${a.action.guest_name ?? "guest"} (demo)`);
          break;
        }
        case "prioritize_ticket": {
          toast.success(`Flagged ticket #${a.action.order_prefix ?? ""} to kitchen`);
          break;
        }
        default: {
          toast.success("Advisory acknowledged");
        }
      }
      setApproved((s) => new Set(s).add(a.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      toast.error(msg);
    }
  }, [menu, tables, waitlist]);

  const dismissAction = useCallback((id: string) => {
    setDismissed((s) => new Set(s).add(id));
  }, []);

  const visibleActions = (plan?.actions ?? []).filter((a) => !dismissed.has(a.id));
  const visibleRisks = plan?.risks ?? [];

  return (
    <div className={`min-h-dvh ${emergency ? "bg-red-950/40" : "bg-background"}`}>
      {emergency && (
        <div className="border-b border-red-500/30 bg-red-500/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-sm">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">Emergency Mode</span>
              <span className="text-red-200/80">Health {health.score}. Autopilot recommending immediate recovery moves.</span>
            </div>
            <Badge variant="destructive" className="uppercase">critical</Badge>
          </div>
        </div>
      )}

      <header className="relative z-10 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Floor</Link></Button>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Cpu className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-semibold leading-none">Autopilot</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">AI restaurant operating system</div>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" /> Judge mode
              <Switch checked={judgeMode} onCheckedChange={setJudgeMode} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radar className="h-3.5 w-3.5" /> Autopilot
              <Switch checked={autoPilot} onCheckedChange={setAutoPilot} />
            </label>
            <Button size="sm" onClick={() => void requestPlan()} disabled={planBusy}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              {planBusy ? "Thinking…" : "Run now"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Row 1: Health + Narrative */}
        <div className="grid gap-6 lg:grid-cols-3">
          <HealthCard health={health} emergency={emergency} lastRun={lastRun} />
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur lg:col-span-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Brain className="h-4 w-4 text-primary" /> Autopilot narrative
            </div>
            <p className="mt-3 text-lg leading-relaxed">
              {plan?.narrative ?? "Waiting for the first autopilot sweep…"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniKpi icon={<Activity className="h-3.5 w-3.5" />} label="Active tickets" value={String(activeOrders.length)} />
              <MiniKpi icon={<Users className="h-3.5 w-3.5" />} label="Waiting" value={String(waitlist.filter((w) => w.status === "waiting").length)} />
              <MiniKpi icon={<TrendingUp className="h-3.5 w-3.5" />} label="Rev 24h" value={`$${revenue24h.toFixed(0)}`} />
              <MiniKpi icon={<Flame className="h-3.5 w-3.5" />} label="Kitchen queue" value={String(items.filter((i) => i.status !== "served").length)} />
            </div>
          </Card>
        </div>

        {/* Row 2: Action cards */}
        <section>
          <SectionHeader icon={<Rocket className="h-4 w-4" />} title="Action cards" subtitle="Proactive moves — you stay in control." />
          {visibleActions.length === 0 ? (
            <Card className="border-white/10 bg-card/50 p-8 text-center text-sm text-muted-foreground">
              {plan ? "No action needed right now. Autopilot is watching." : "Autopilot has not run yet."}
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleActions.map((a) => (
                <ActionCard
                  key={a.id}
                  a={a}
                  approved={approved.has(a.id)}
                  onApprove={() => void approveAction(a)}
                  onDismiss={() => dismissAction(a.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Row 3: Risks + Simulator */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RiskPanel risks={visibleRisks} />
          <TwinSimulator
            baseHealth={health.score}
            menu={menu}
            tables={tables}
            waiting={waitlist.filter((w) => w.status === "waiting").length}
            backlog={items.filter((i) => i.status !== "served").length}
            revenue24h={revenue24h}
          />
        </div>

        {/* Row 4: Restaurant Memory */}
        <MemoryTimeline orders={orders} tables={tables} waitlist={waitlist} />
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><span className="text-primary">{icon}</span> {title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function MiniKpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function HealthCard({ health, emergency, lastRun }: { health: HealthBreakdown; emergency: boolean; lastRun: number }) {
  const tone = emergency ? "text-red-400" : health.score >= 80 ? "text-primary" : "text-amber-400";
  return (
    <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Gauge className="h-4 w-4 text-primary" /> Health score
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className={`text-6xl font-bold tracking-tighter ${tone}`}>{health.score}</div>
        <div className="pb-2 text-xs text-muted-foreground">/ 100 · {emergency ? "Emergency" : health.score >= 80 ? "Healthy" : "Watch"}</div>
      </div>
      <div className="mt-4 space-y-1.5">
        {health.contributions.map((c) => (
          <div key={c.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{c.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/70">{c.detail}</span>
              <span className={`font-mono ${c.delta > 0 ? "text-primary" : c.delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {c.delta > 0 ? "+" : ""}{c.delta}
              </span>
            </span>
          </div>
        ))}
      </div>
      {lastRun > 0 && (
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" /> Autopilot swept {Math.round((Date.now() - lastRun) / 1000)}s ago
        </div>
      )}
    </Card>
  );
}

function ActionCard({ a, approved, onApprove, onDismiss }: { a: AutopilotAction; approved: boolean; onApprove: () => void; onDismiss: () => void }) {
  const sevTone = a.severity === "critical" ? "border-red-500/40 bg-red-500/5" : a.severity === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-card/70";
  const sevBadge = a.severity === "critical" ? "destructive" : a.severity === "warn" ? "default" : "secondary";
  return (
    <Card className={`p-5 backdrop-blur ${sevTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={sevBadge as "default" | "destructive" | "secondary"} className="uppercase">{a.severity}</Badge>
            <span className="text-[11px] text-muted-foreground">Confidence {a.confidence}%</span>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-snug">{a.title}</h3>
        </div>
        {approved ? (
          <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Approved</Badge>
        ) : (
          <button onClick={onDismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        )}
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <Row label="Problem" value={a.problem} />
        <Row label="Root cause" value={a.root_cause} />
        <Row label="Business impact" value={a.business_impact} />
        <Row label="Recommend" value={a.recommended_action} />
        <Row label="Est. improvement" value={a.estimated_improvement} highlight />
      </div>
      {a.signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.signals.map((s) => (
            <span key={s} className="rounded-full border border-white/10 bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{s}</span>
          ))}
        </div>
      )}
      {!approved && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={onApprove} className="flex-1"><Zap className="mr-1.5 h-3.5 w-3.5" /> Approve</Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>Dismiss</Button>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="min-w-[112px] text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={highlight ? "text-primary font-medium" : ""}>{value}</span>
    </div>
  );
}

function RiskPanel({ risks }: { risks: RiskPrediction[] }) {
  return (
    <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Shield className="h-4 w-4 text-primary" /> Risk radar
      </div>
      {risks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No predicted risks in the next hour.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {risks.map((r) => (
            <div key={r.id} className="rounded-lg border border-white/10 bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono text-primary">{r.probability}%</span>
                  <span>·</span>
                  <span>ETA {r.eta_minutes}m</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full bg-primary/70" style={{ width: `${r.probability}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-foreground">Intervene:</span> {r.intervention}
              </p>
              {r.signals.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.signals.map((s) => (
                    <span key={s} className="rounded-full border border-white/10 bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Digital Twin — deterministic what-if simulator
// ────────────────────────────────────────────────────────────────
function TwinSimulator({ baseHealth, menu, tables, waiting, backlog, revenue24h }: {
  baseHealth: number;
  menu: MenuItem[];
  tables: DiningTable[];
  waiting: number;
  backlog: number;
  revenue24h: number;
}) {
  const [hideItem, setHideItem] = useState(false);
  const [addCook, setAddCook] = useState(false);
  const [closeTable, setCloseTable] = useState(false);
  const [rush, setRush] = useState(0); // 0..100 rush intensity
  const [bigRes, setBigRes] = useState(false);

  const sim = useMemo(() => {
    let h = baseHealth;
    let waitDelta = 0;
    let revDelta = 0;
    let queueDelta = 0;
    let backlogDelta = 0;
    let satDelta = 0;

    if (hideItem) { h += 3; backlogDelta -= 2; waitDelta -= 3; satDelta += 1; }
    if (addCook) { h += 8; backlogDelta -= Math.min(backlog, 4); waitDelta -= 5; satDelta += 3; }
    if (closeTable) { h -= 4; queueDelta += 1; revDelta -= 40; }
    if (bigRes) { h -= 3; queueDelta += 4; revDelta += 180; waitDelta += 4; }
    if (rush > 0) {
      const r = rush / 100;
      h -= Math.round(15 * r);
      backlogDelta += Math.round(6 * r);
      waitDelta += Math.round(8 * r);
      queueDelta += Math.round(5 * r);
      revDelta += Math.round(240 * r);
      satDelta -= Math.round(4 * r);
    }
    h = Math.max(0, Math.min(100, Math.round(h)));

    return {
      health: h,
      wait: Math.max(0, 8 + waitDelta),
      queue: Math.max(0, waiting + queueDelta),
      backlog: Math.max(0, backlog + backlogDelta),
      revenue: Math.max(0, Math.round(revenue24h + revDelta)),
      satisfaction: Math.max(0, Math.min(100, 78 + satDelta * 3)),
    };
  }, [baseHealth, hideItem, addCook, closeTable, bigRes, rush, backlog, waiting, revenue24h]);

  const firstItem = menu.find((m) => m.is_available)?.name ?? "top item";
  const lastTable = tables[tables.length - 1]?.label ?? "a table";

  return (
    <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Wand2 className="h-4 w-4 text-primary" /> Digital twin · what-if
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Simulate decisions before you make them. Uses current floor as baseline.</p>
      <div className="mt-4 space-y-3 text-sm">
        <Toggle label={`Hide "${firstItem}"`} checked={hideItem} onChange={setHideItem} />
        <Toggle label="Add one cook" checked={addCook} onChange={setAddCook} />
        <Toggle label={`Close ${lastTable}`} checked={closeTable} onChange={setCloseTable} />
        <Toggle label="Accept large reservation (party of 8)" checked={bigRes} onChange={setBigRes} />
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Rush intensity</span>
            <span className="font-mono text-primary">{rush}%</span>
          </div>
          <Slider value={[rush]} onValueChange={(v) => setRush(v[0] ?? 0)} max={100} step={5} className="mt-2" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:grid-cols-3">
        <SimStat label="Health" value={String(sim.health)} delta={sim.health - baseHealth} />
        <SimStat label="Avg wait" value={`${sim.wait}m`} />
        <SimStat label="Queue" value={String(sim.queue)} />
        <SimStat label="Kitchen" value={String(sim.backlog)} />
        <SimStat label="Revenue" value={`$${sim.revenue}`} />
        <SimStat label="Satisfaction" value={`${sim.satisfaction}%`} />
      </div>
    </Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-white/10 bg-background/40 px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function SimStat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-[11px] font-mono ${delta > 0 ? "text-primary" : "text-red-400"}`}>{delta > 0 ? "+" : ""}{delta}</span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Restaurant Memory — replay of the day
// ────────────────────────────────────────────────────────────────
type MemoryEvent = { ts: string; label: string; detail: string; tone: string };

function MemoryTimeline({ orders, tables, waitlist }: { orders: Order[]; tables: DiningTable[]; waitlist: WaitEntry[] }) {
  const events: MemoryEvent[] = useMemo(() => {
    const ev: MemoryEvent[] = [];
    orders.forEach((o) => {
      ev.push({
        ts: o.created_at,
        label: `Order placed · ${tables.find((t) => t.id === o.table_id)?.label ?? "Takeaway"}`,
        detail: `${o.guest_name ?? "Guest"} · $${(o.total_cents / 100).toFixed(2)}`,
        tone: "text-primary",
      });
      if (o.status === "closed" || o.status === "served") {
        ev.push({ ts: o.updated_at, label: `Order ${o.status}`, detail: `#${o.id.slice(0, 6)}`, tone: "text-muted-foreground" });
      }
    });
    waitlist.forEach((w) => {
      ev.push({
        ts: w.created_at,
        label: `Walk-in: ${w.guest_name}`,
        detail: `Party of ${w.party_size} · quoted ${w.quoted_minutes}m`,
        tone: "text-amber-400",
      });
    });
    return ev.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 30);
  }, [orders, tables, waitlist]);

  return (
    <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <ChefHat className="h-4 w-4 text-primary" /> Restaurant memory · last 24h
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No events yet today.</p>
      ) : (
        <div className="mt-4 max-h-[420px] overflow-y-auto pr-2">
          <ol className="relative border-l border-white/10 pl-4">
            {events.map((e, i) => (
              <li key={i} className="mb-4">
                <div className="absolute -left-1 mt-1.5 h-2 w-2 rounded-full bg-primary" />
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`text-sm ${e.tone}`}>{e.label}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="text-xs text-muted-foreground">{e.detail}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
