import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Activity,
  ChefHat,
  CircleDot,
  Clock,
  LogOut,
  Sparkles,
  QrCode,
  Utensils,
  Users,
  Brain,
  Cpu,
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    void loadAll();

    const ch = supabase
      .channel("occupancy-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, loadTables)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadReservationStats)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservation_events" }, loadReservationEvents)
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  async function loadAll() {
    await Promise.all([loadItems(), loadTables(), loadOrders(), loadReservationStats(), loadReservationEvents()]);
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

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const availableCount = items.filter((i) => i.is_available).length;
  const seatedCount = tables.filter((t) => t.status === "seated").length;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <ChefHat className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">Occupancy</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Live floor</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Realtime
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            <Button asChild variant="outline" size="sm">
              <Link to="/autopilot"><Cpu className="mr-1.5 h-4 w-4" /> Autopilot</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/intel"><Brain className="mr-1.5 h-4 w-4" /> Intel</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/ops"><Sparkles className="mr-1.5 h-4 w-4" /> Copilot</Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link to="/host"><Users className="mr-1.5 h-4 w-4" /> Host</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/tables"><QrCode className="mr-1.5 h-4 w-4" /> QR</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/menu"><Utensils className="mr-1.5 h-4 w-4" /> Menu</Link>
            </Button>


            <Button asChild variant="outline" size="sm">
              <Link to="/kds"><ChefHat className="mr-1.5 h-4 w-4" /> KDS</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<Utensils className="h-4 w-4" />} label="Menu items live" value={`${availableCount}/${items.length}`} />
          <Kpi icon={<CircleDot className="h-4 w-4" />} label="Tables seated" value={`${seatedCount}/${tables.length}`} />
          <Kpi icon={<Activity className="h-4 w-4" />} label="Active orders" value={String(orders.length)} />
          <Kpi icon={<Sparkles className="h-4 w-4" />} label="Avg prep" value={`${avgPrep(items)} min`} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Menu */}
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur lg:col-span-2">
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
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
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
                    {(o.status === "ready" || o.status === "served") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const { error } = await supabase.from("orders").update({ status: "closed" }).eq("id", o.id);
                          if (error) toast.error("Could not close");
                          else toast.success("Ticket closed & paid");
                        }}
                      >
                        Close · paid
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
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
