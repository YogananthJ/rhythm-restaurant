import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChefHat, CheckCircle2, Clock, Flame, Star, Utensils } from "lucide-react";
import { z } from "zod";

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
  name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  status: string;
  notes: string | null;
  created_at?: string;
};

const searchSchema = z.object({ k: z.string().min(8).max(128) });

export const Route = createFileRoute("/t/$token/order/$orderId")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Your order — Occupancy" },
      { name: "description", content: "Live order status from the kitchen." },
    ],
  }),
  component: OrderStatus,
});

const STAGES = ["placed", "preparing", "ready", "served"] as const;

function OrderStatus() {
  const { orderId } = Route.useParams();
  const { k: accessToken } = Route.useSearch();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_guest_order", {
      p_order_id: orderId,
      p_access_token: accessToken,
    });
    if (error || !data) {
      setNotFound(true);
      return;
    }
    const payload = data as { order: Order; items: OrderItem[] };
    setOrder(payload.order);
    setItems(payload.items ?? []);
  }, [orderId, accessToken]);

  useEffect(() => {
    void load();
    // Realtime channel scoped to this order (SELECT is now staff-only, but the
    // realtime layer still lets us listen for the change events and re-fetch
    // through the token-scoped RPC).
    const ch = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orderId, load]);

  if (notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Order not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link is invalid or has expired. Ask your server for help.
          </p>
        </div>
      </div>
    );
  }

  const stageIdx = order ? Math.max(0, STAGES.indexOf(order.status as (typeof STAGES)[number])) : 0;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <ChefHat className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Occupancy</span>
          </Link>
          <Badge variant="secondary" className="gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Live status
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Order sent</div>
          <h1 className="mt-1 text-2xl font-semibold">Thanks{order?.guest_name ? `, ${order.guest_name}` : ""}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You'll see progress here in real time as the kitchen works your ticket.
          </p>
        </div>

        <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {STAGES.map((s, i) => (
              <StageDot key={s} label={s} active={i <= stageIdx} icon={stageIcon(s)} />
            ))}
          </div>
        </Card>

        <Card className="mt-6 border-white/10 bg-card/70 p-6 backdrop-blur">
          <div className="mb-4 text-sm font-semibold">Ticket</div>
          <div className="divide-y divide-white/5">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    <span className="text-muted-foreground">{it.quantity}×</span> {it.name_snapshot}
                  </div>
                  {it.notes && (
                    <div className="mt-0.5 text-xs italic text-muted-foreground">"{it.notes}"</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {it.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ${((it.unit_price_cents * it.quantity) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="text-lg font-semibold">${((order?.total_cents ?? 0) / 100).toFixed(2)}</span>
          </div>
        </Card>
      </main>
    </div>
  );
}

function StageDot({ label, active, icon }: { label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 text-center transition-all ${active ? "border-primary/40 bg-primary/10 text-foreground" : "border-white/10 bg-white/[0.02] text-muted-foreground"}`}>
      <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full ${active ? "bg-primary/20 text-primary" : "bg-white/5"}`}>
        {icon}
      </div>
      <div className="mt-2 text-[10px] font-medium uppercase tracking-wider">{label}</div>
    </div>
  );
}

function stageIcon(s: string) {
  const cls = "h-4 w-4";
  switch (s) {
    case "placed":
      return <Clock className={cls} />;
    case "preparing":
      return <Flame className={cls} />;
    case "ready":
      return <Utensils className={cls} />;
    default:
      return <CheckCircle2 className={cls} />;
  }
}
