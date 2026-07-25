import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChefHat, Clock, Flame, CheckCircle2, Utensils, ArrowRight } from "lucide-react";

type Order = {
  id: string;
  status: string;
  guest_name: string | null;
  total_cents: number;
  created_at: string;
  table_id: string | null;
};
type OrderItem = {
  id: string;
  order_id: string;
  name_snapshot: string;
  quantity: number;
  status: string;
  notes: string | null;
};
type Table = { id: string; label: string };

const NEXT_STATUS: Record<string, string> = {
  placed: "preparing",
  preparing: "ready",
  ready: "served",
};
const NEXT_LABEL: Record<string, string> = {
  placed: "Start cooking",
  preparing: "Mark ready",
  ready: "Mark served",
};

export const Route = createFileRoute("/_authenticated/kds")({
  head: () => ({
    meta: [
      { title: "Kitchen Display — Occupancy" },
      { name: "description", content: "Real-time kitchen ticket queue with one-tap status flow." },
      { property: "og:title", content: "Kitchen Display — Occupancy" },
      { property: "og:description", content: "Real-time kitchen ticket queue." },
    ],
  }),
  component: KDS,
});

function KDS() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void loadAll();
    const ch = supabase
      .channel("kds")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, loadItems)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, []);

  async function loadAll() {
    await Promise.all([loadOrders(), loadItems(), loadTables()]);
  }
  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["placed", "preparing", "ready"])
      .order("created_at", { ascending: true });
    if (data) setOrders(data as Order[]);
  }
  async function loadItems() {
    const { data } = await supabase.from("order_items").select("*").order("created_at");
    if (data) setItems(data as OrderItem[]);
  }
  async function loadTables() {
    const { data } = await supabase.from("dining_tables").select("id,label");
    if (data) setTables(data as Table[]);
  }

  async function advance(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);
    if (error) {
      toast.error("Update failed");
      return;
    }
    // cascade item status when appropriate
    if (next === "preparing" || next === "ready") {
      await supabase
        .from("order_items")
        .update({ status: next === "preparing" ? "cooking" : "ready" })
        .eq("order_id", order.id);
    }
    // auto-update the dining table status to mirror kitchen progress
    if (order.table_id) {
      const tableStatus =
        next === "preparing" ? "occupied" : next === "ready" ? "needs_service" : "occupied";
      await supabase
        .from("dining_tables")
        .update({ status: tableStatus })
        .eq("id", order.table_id);
    }
    toast.success(`Ticket → ${next}`);
  }

  const columns: { key: string; title: string; icon: React.ReactNode; tone: string }[] = [
    { key: "placed", title: "New", icon: <Clock className="h-4 w-4" />, tone: "border-blue-400/30 bg-blue-500/5" },
    { key: "preparing", title: "Cooking", icon: <Flame className="h-4 w-4" />, tone: "border-amber-400/30 bg-amber-500/5" },
    { key: "ready", title: "Ready", icon: <Utensils className="h-4 w-4" />, tone: "border-emerald-400/30 bg-emerald-500/5" },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <ChefHat className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">Kitchen Display</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">One tap per stage</div>
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
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {columns.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.key);
            return (
              <div key={col.key} className={`rounded-2xl border p-4 ${col.tone}`}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-primary">{col.icon}</span>
                    {col.title}
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{colOrders.length}</span>
                </div>
                <div className="space-y-3">
                  {colOrders.map((o) => (
                    <TicketCard
                      key={o.id}
                      order={o}
                      items={items.filter((i) => i.order_id === o.id)}
                      table={tables.find((t) => t.id === o.table_id)?.label ?? "TA"}
                      minutes={Math.floor((now - new Date(o.created_at).getTime()) / 60000)}
                      onAdvance={() => advance(o)}
                    />
                  ))}
                  {colOrders.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-xs text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function TicketCard({
  order,
  items,
  table,
  minutes,
  onAdvance,
}: {
  order: Order;
  items: OrderItem[];
  table: string;
  minutes: number;
  onAdvance: () => void;
}) {
  const urgent = minutes >= 15;
  return (
    <Card className={`border-white/10 bg-card/80 p-4 backdrop-blur ${urgent ? "ring-1 ring-amber-400/50" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            {table}
          </span>
          <span className="text-xs text-muted-foreground">{order.guest_name ?? "Guest"}</span>
        </div>
        <span className={`text-xs font-medium ${urgent ? "text-amber-300" : "text-muted-foreground"}`}>
          {minutes}m
        </span>
      </div>
      <ul className="mb-3 space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="text-sm">
            <div className="flex items-baseline gap-1.5">
              <span className="font-medium text-primary">{it.quantity}×</span>
              <span>{it.name_snapshot}</span>
            </div>
            {it.notes && (
              <div className="ml-5 mt-0.5 text-[11px] italic text-amber-300/80">"{it.notes}"</div>
            )}
          </li>
        ))}
      </ul>
      <Button size="sm" onClick={onAdvance} className="w-full">
        {NEXT_LABEL[order.status] ?? "Advance"}
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
