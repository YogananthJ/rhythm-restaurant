import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BillingDialog } from "@/components/BillingDialog";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ReviewsWidget } from "@/components/reviews/ReviewsWidget";

import { toast } from "sonner";
import {
  BarChart3,
  Activity,
  CalendarClock,
  ChefHat,
  CircleDot,
  Clock,
  FileText,
  LogOut,
  Sparkles,
  QrCode,
  Utensils,
  Users,
  Brain,
  Cpu,
  Receipt,
} from "lucide-react";




type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  prep_minutes: number;
  category_id: string | null;
};

type DiningTable = {
  id: string;
  label: string;
  seats: number;
  status: string;
};

type Order = {
  id: string;
  status: string;
  guest_name: string | null;
  total_cents: number;
  created_at: string;
  table_id: string | null;
};

type ResStats = {
  upcoming: number;
  seatedToday: number;
  noShows: number;
  cancelled: number;
  avgWaitMin: number;
  occupancyPct: number;
};

type ResEvent = {
  id: string;
  reservation_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type KitchenStats = {
  avgReadyMin: number;
  medianReadyMin: number;
  overdue: number;
  completed12h: number;
  inFlight: number;
  throughput: { hour: string; count: number }[];
  slowest: { id: string; guest: string; minutes: number; status: string }[];
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Live Floor — Occupancy" },
      { name: "description", content: "Real-time restaurant dashboard: menu availability, table status, and open orders." },
      { property: "og:title", content: "Live Floor — Occupancy" },
      { property: "og:description", content: "The shared real-time state of your restaurant." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [billOrderId, setBillOrderId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [resStats, setResStats] = useState<ResStats>({
    upcoming: 0,
    seatedToday: 0,
    noShows: 0,
    cancelled: 0,
    avgWaitMin: 0,
    occupancyPct: 0,
  });
  const [resEvents, setResEvents] = useState<ResEvent[]>([]);
  const [kitchen, setKitchen] = useState<KitchenStats>({
    avgReadyMin: 0,
    medianReadyMin: 0,
    overdue: 0,
    completed12h: 0,
    inFlight: 0,
    throughput: [],
    slowest: [],
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    supabase.from("restaurants").select("id").limit(1).maybeSingle().then(({ data }) => {
      if (data?.id) setRestaurantId(data.id);
    });
    void loadAll();

    const ch = supabase
      .channel("occupancy-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, loadTables)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void loadOrders(); void loadKitchenStats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadReservationStats)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservation_events" }, loadReservationEvents)
      .subscribe();

    const tick = setInterval(() => void loadKitchenStats(), 30000);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, []);

  async function loadAll() {
    await Promise.all([loadItems(), loadTables(), loadOrders(), loadReservationStats(), loadReservationEvents(), loadKitchenStats()]);
  }

  async function loadItems() {
    const { data } = await supabase.from("menu_items").select("*").order("name");
    if (data) setItems(data as MenuItem[]);
  }
  async function loadTables() {
    const { data } = await supabase.from("dining_tables").select("*").order("label");
    if (data) setTables(data as DiningTable[]);
  }
  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["open", "placed", "preparing", "ready"])
      .order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
  }

  async function loadReservationStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: allToday } = await supabase
      .from("reservations")
      .select("id, status, party_size, requested_at, created_at, table_id")
      .gte("requested_at", startOfDay.toISOString());
    const rows = (allToday ?? []) as Array<{
      id: string; status: string; party_size: number; requested_at: string; created_at: string; table_id: string | null;
    }>;
    const now = Date.now();
    const upcoming = rows.filter((r) => (r.status === "pending" || r.status === "confirmed") && new Date(r.requested_at).getTime() > now).length;
    const seatedToday = rows.filter((r) => r.status === "seated").length;
    const noShows = rows.filter((r) => r.status === "no_show").length;
    const cancelled = rows.filter((r) => r.status === "cancelled").length;

    // Avg wait: for seated today, time from requested_at to when the "seated" event was logged
    const seatedIds = rows.filter((r) => r.status === "seated").map((r) => r.id);
    let avgWaitMin = 0;
    if (seatedIds.length) {
      const { data: evs } = await supabase
        .from("reservation_events")
        .select("reservation_id, created_at, to_status")
        .in("reservation_id", seatedIds)
        .eq("to_status", "seated");
      const byRes = new Map<string, string>((evs ?? []).map((e: { reservation_id: string; created_at: string }) => [e.reservation_id, e.created_at]));
      const waits: number[] = [];
      for (const r of rows) {
        if (r.status !== "seated") continue;
        const seatedAt = byRes.get(r.id);
        if (!seatedAt) continue;
        const diff = (new Date(seatedAt).getTime() - new Date(r.requested_at).getTime()) / 60000;
        if (!Number.isNaN(diff)) waits.push(diff);
      }
      if (waits.length) avgWaitMin = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
    }

    // Occupancy: seats currently occupied by seated reservations vs total table seats
    const { data: tbls } = await supabase.from("dining_tables").select("seats");
    const totalSeats = (tbls ?? []).reduce((s, t: { seats: number }) => s + t.seats, 0);
    const seatedNow = rows
      .filter((r) => r.status === "seated")
      .reduce((s, r) => s + r.party_size, 0);
    const occupancyPct = totalSeats ? Math.min(100, Math.round((seatedNow / totalSeats) * 100)) : 0;

    setResStats({ upcoming, seatedToday, noShows, cancelled, avgWaitMin, occupancyPct });
  }

  async function loadReservationEvents() {
    const { data } = await supabase
      .from("reservation_events")
      .select("id, reservation_id, event_type, from_status, to_status, details, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    if (data) setResEvents(data as ResEvent[]);
  }

  async function loadKitchenStats() {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("id, status, guest_name, created_at, updated_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Array<{ id: string; status: string; guest_name: string | null; created_at: string; updated_at: string }>;
    const now = Date.now();
    const OVERDUE_MIN = 20;

    const completedStatuses = new Set(["ready", "served", "paid", "closed"]);
    const inFlightStatuses = new Set(["open", "placed", "preparing"]);

    const readyDurations: number[] = [];
    let completed12h = 0;
    const throughputMap = new Map<string, number>();
    // Seed last 12 hours buckets
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now - i * 3600 * 1000);
      d.setMinutes(0, 0, 0);
      throughputMap.set(d.toISOString(), 0);
    }
    for (const r of rows) {
      if (completedStatuses.has(r.status)) {
        const dur = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 60000;
        if (dur >= 0 && dur < 240) readyDurations.push(dur);
        completed12h++;
        const b = new Date(r.updated_at);
        b.setMinutes(0, 0, 0);
        const key = b.toISOString();
        if (throughputMap.has(key)) throughputMap.set(key, (throughputMap.get(key) ?? 0) + 1);
      }
    }
    const avgReadyMin = readyDurations.length
      ? Math.round(readyDurations.reduce((a, b) => a + b, 0) / readyDurations.length)
      : 0;
    const sorted = [...readyDurations].sort((a, b) => a - b);
    const medianReadyMin = sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]) : 0;

    const inFlight = rows.filter((r) => inFlightStatuses.has(r.status));
    const overdueList = inFlight
      .map((r) => ({
        id: r.id,
        guest: r.guest_name ?? "Guest",
        minutes: Math.round((now - new Date(r.created_at).getTime()) / 60000),
        status: r.status,
      }))
      .filter((r) => r.minutes >= OVERDUE_MIN)
      .sort((a, b) => b.minutes - a.minutes);

    const throughput = Array.from(throughputMap.entries()).map(([iso, count]) => ({
      hour: new Date(iso).toLocaleTimeString([], { hour: "numeric" }),
      count,
    }));

    setKitchen({
      avgReadyMin,
      medianReadyMin,
      overdue: overdueList.length,
      completed12h,
      inFlight: inFlight.length,
      throughput,
      slowest: overdueList.slice(0, 5),
    });
  }

  async function toggleAvailability(item: MenuItem) {
    const next = !item.is_available;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: next } : i)));
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: next })
      .eq("id", item.id);
    if (error) {
      toast.error("Update failed — reverting");
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !next } : i)));
    } else {
      toast.success(next ? `${item.name} back on menu` : `86'd ${item.name}`);
    }
  }

  async function cycleTableStatus(t: DiningTable) {
    const cycle = ["available", "seated", "reserved", "cleaning"];
    const next = cycle[(cycle.indexOf(t.status) + 1) % cycle.length];
    await supabase.from("dining_tables").update({ status: next }).eq("id", t.id);
  }



  const availableCount = items.filter((i) => i.is_available).length;
  const seatedCount = tables.filter((t) => t.status === "seated").length;

  return (
    <div className="relative min-h-dvh w-full bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">Live floor</h1>
            <p className="text-xs text-muted-foreground">{email || "Realtime kitchen-to-table intelligence"}</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi index={0} icon={<Utensils className="h-4 w-4" />} label="Menu items live" value={`${availableCount}/${items.length}`} />
          <Kpi index={1} icon={<CircleDot className="h-4 w-4" />} label="Tables seated" value={`${seatedCount}/${tables.length}`} />
          <Kpi index={2} icon={<Activity className="h-4 w-4" />} label="Active orders" value={String(orders.length)} num={orders.length} />
          <Kpi index={3} icon={<Sparkles className="h-4 w-4" />} label="Avg prep" value={`${avgPrep(items)} min`} num={avgPrep(items)} suffix=" min" />
        </div>

        <ReviewsWidget />


        {/* Kitchen KPIs */}
        <Card className="mt-6 border-white/10 bg-card/70 p-6 backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Kitchen KPIs · last 12h</h2>
              <p className="text-xs text-muted-foreground">Time-to-ready, overdue tickets, and throughput by hour — spot bottlenecks fast.</p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">Live</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MiniStat label="Avg time-to-ready" value={`${kitchen.avgReadyMin}m`} tone="primary" />
            <MiniStat label="Median" value={`${kitchen.medianReadyMin}m`} tone="accent" />
            <MiniStat label="Overdue (>20m)" value={String(kitchen.overdue)} tone={kitchen.overdue > 0 ? "warn" : "muted"} />
            <MiniStat label="In flight" value={String(kitchen.inFlight)} tone="muted" />
            <MiniStat label="Completed 12h" value={String(kitchen.completed12h)} tone="primary" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
                <span>Throughput by hour</span>
                <span>tickets completed</span>
              </div>
              <div className="flex h-32 items-end gap-1.5">
                {kitchen.throughput.map((b, i) => {
                  const max = Math.max(1, ...kitchen.throughput.map((x) => x.count));
                  const pct = (b.count / max) * 100;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t bg-primary/70 transition-all hover:bg-primary"
                          style={{ height: `${Math.max(pct, b.count > 0 ? 6 : 2)}%` }}
                          title={`${b.hour}: ${b.count}`}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{b.hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Slowest open tickets</div>
              {kitchen.slowest.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 py-6 text-center text-xs text-muted-foreground">
                  Nothing overdue. Kitchen's cruising.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {kitchen.slowest.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs">
                      <div>
                        <div className="font-medium">{s.guest}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.status}</div>
                      </div>
                      <span className="font-semibold text-amber-300">{s.minutes}m</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>


        {/* Reservations analytics + audit log */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="min-w-0 border-white/10 bg-card/70 p-6 backdrop-blur lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Reservations · today</h2>
                <p className="text-xs text-muted-foreground">Occupancy, wait times, no-shows — updated live.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/host"><CalendarClock className="mr-1.5 h-4 w-4" /> Manage</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniStat label="Upcoming" value={String(resStats.upcoming)} tone="primary" />
              <MiniStat label="Seated today" value={String(resStats.seatedToday)} tone="primary" />
              <MiniStat label="Occupancy" value={`${resStats.occupancyPct}%`} tone="accent" />
              <MiniStat label="Avg wait to seat" value={`${resStats.avgWaitMin}m`} tone="accent" />
              <MiniStat label="No-shows" value={String(resStats.noShows)} tone={resStats.noShows > 0 ? "warn" : "muted"} />
              <MiniStat label="Cancelled" value={String(resStats.cancelled)} tone="muted" />
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Live occupancy</span>
                <span>{resStats.occupancyPct}% of seats filled</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${resStats.occupancyPct}%` }}
                />
              </div>
            </div>
          </Card>

          <Card className="min-w-0 border-white/10 bg-card/70 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Event log</h2>
              <Badge variant="outline" className="text-[10px]">Audit</Badge>
            </div>
            {resEvents.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No reservation activity yet.
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {resEvents.map((ev) => (
                  <li key={ev.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">{eventLabel(ev)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {eventDetail(ev)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>


        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Menu */}
          <Card className="min-w-0 border-white/10 bg-card/70 p-6 backdrop-blur lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Live menu</h2>
                <p className="text-xs text-muted-foreground">Toggle availability — every device updates instantly.</p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">86 in one tap</Badge>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${item.is_available ? "" : "text-muted-foreground line-through"}`}>
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · ${(item.price_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {item.prep_minutes}m
                    <Switch checked={item.is_available} onCheckedChange={() => toggleAvailability(item)} />
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No menu items yet.</p>
              )}
            </div>
          </Card>

          {/* Tables */}
          <Card className="min-w-0 border-white/10 bg-card/70 p-6 backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Floor status</h2>
              <span className="text-xs text-muted-foreground">Tap to cycle</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => cycleTableStatus(t)}
                  className={`group rounded-xl border p-4 text-left transition-all ${tableTone(t.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-80">{t.status}</span>
                  </div>
                  <div className="mt-2 text-xs opacity-80">{t.seats} seats</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Orders */}
        <Card className="mt-6 border-white/10 bg-card/70 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Open orders</h2>
            <span className="text-xs text-muted-foreground">{orders.length} in flight</span>
          </div>
          {orders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-muted-foreground">
              No active orders. New guest orders will appear here in real time.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{o.guest_name ?? "Guest"} · {tableLabel(o.table_id, tables)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge>{o.status}</Badge>
                    <span className="text-muted-foreground">${(o.total_cents / 100).toFixed(2)}</span>
                    <Button
                      size="sm"
                      variant={o.status === "ready" || o.status === "served" ? "default" : "outline"}
                      onClick={() => setBillOrderId(o.id)}
                    >
                      <Receipt className="mr-1 h-4 w-4" />Bill
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
      <BillingDialog orderId={billOrderId} open={!!billOrderId} onOpenChange={(open: boolean) => !open && setBillOrderId(null)} onClosed={() => { setBillOrderId(null); loadOrders(); }} />

    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  num,
  suffix,
  index = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  num?: number;
  suffix?: string;
  index?: number;
}) {
  return (
    <Card
      className="hover-lift rise-in border-white/10 bg-card/70 p-5 backdrop-blur"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {typeof num === "number" ? <AnimatedNumber value={num} suffix={suffix} /> : value}
      </div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "primary" | "accent" | "warn" | "muted";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/25 bg-primary/5 text-primary"
      : tone === "accent"
        ? "border-accent/25 bg-accent/5 text-accent"
        : tone === "warn"
          ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
          : "border-white/10 bg-white/[0.02] text-foreground";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</div>
    </div>
  );
}

function eventLabel(ev: ResEvent) {
  if (ev.event_type === "created") return "New reservation";
  if (ev.event_type === "deleted") return "Reservation deleted";
  if (ev.event_type === "table_assigned") return "Table assigned";
  if (ev.event_type === "status_change") return `${ev.from_status ?? "?"} → ${ev.to_status ?? "?"}`;
  return ev.event_type;
}

function eventDetail(ev: ResEvent) {
  const d = ev.details ?? {};
  const guest = (d as { guest_name?: string }).guest_name;
  const party = (d as { party_size?: number }).party_size;
  const at = (d as { requested_at?: string }).requested_at;
  if (guest) {
    const time = at ? new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    return `${guest}${party ? ` · party of ${party}` : ""}${time ? ` · ${time}` : ""}`;
  }
  return `Reservation ${ev.reservation_id.slice(0, 8).toUpperCase()}`;
}


function tableTone(status: string) {
  switch (status) {
    case "seated":
      return "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15";
    case "reserved":
      return "border-amber-400/30 bg-amber-500/5 text-foreground hover:bg-amber-500/10";
    case "cleaning":
      return "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10";
    default:
      return "border-white/10 bg-background/40 hover:bg-white/5";
  }
}

function tableLabel(id: string | null, tables: DiningTable[]) {
  if (!id) return "Takeaway";
  return tables.find((t) => t.id === id)?.label ?? "—";
}

function avgPrep(items: MenuItem[]) {
  const on = items.filter((i) => i.is_available);
  if (on.length === 0) return 0;
  return Math.round(on.reduce((s, i) => s + i.prep_minutes, 0) / on.length);
}
