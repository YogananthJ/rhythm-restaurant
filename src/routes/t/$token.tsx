import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChefHat, Clock, Minus, Plus, ShoppingBag, Sparkles, X } from "lucide-react";

type Category = { id: string; name: string; sort_order: number };
type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  prep_minutes: number;
};
type Table = { id: string; label: string; restaurant_id: string };
type Restaurant = { id: string; name: string };
type CartLine = { item: MenuItem; qty: number; notes?: string };

export const Route = createFileRoute("/t/$token")({
  head: () => ({
    meta: [
      { title: "Order at your table — Occupancy" },
      { name: "description", content: "Scan, browse the live menu, and order from your table. No app required." },
      { property: "og:title", content: "Order at your table — Occupancy" },
      { property: "og:description", content: "Live menu with real-time availability. Order sent straight to the kitchen." },
    ],
  }),
  component: GuestMenu,
});

function GuestMenu() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [guestName, setGuestName] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase.rpc("resolve_table_by_qr", { p_qr_token: token });
      const t = Array.isArray(rows) ? rows[0] : null;
      if (error || !t) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTable({ id: t.id, label: t.label, restaurant_id: t.restaurant_id });
      setRestaurant({ id: t.restaurant_id, name: t.restaurant_name });
      const [{ data: cats }, { data: its }] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", t.restaurant_id).order("sort_order"),
        supabase.from("menu_items").select("*").eq("restaurant_id", t.restaurant_id).order("name"),
      ]);
      setCategories((cats as Category[]) ?? []);
      setItems((its as MenuItem[]) ?? []);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`guest-menu-${token}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items" }, (payload) => {
        const next = payload.new as MenuItem;
        setItems((prev) => prev.map((i) => (i.id === next.id ? { ...i, ...next } : i)));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [token]);


  const grouped = useMemo(() => {
    return categories.map((c) => ({
      category: c,
      items: items.filter((i) => i.category_id === c.id),
    }));
  }, [categories, items]);

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.qty * l.item.price_cents, 0);

  function addToCart(item: MenuItem) {
    if (!item.is_available) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.item.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { item, qty: 1 }];
    });
    toast.success(`${item.name} added`);
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.item.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function updateNotes(id: string, notes: string) {
    setCart((prev) => prev.map((l) => (l.item.id === id ? { ...l, notes } : l)));
  }

  async function placeOrder() {
    if (!table || cart.length === 0) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("place_guest_order", {
      p_qr_token: token,
      p_guest_name: guestName.trim() || "Guest",
      p_items: cart.map((l) => ({
        menu_item_id: l.item.id,
        quantity: l.qty,
        notes: l.notes ?? null,
      })),
    });
    if (error || !data) {
      toast.error("Couldn't place order — try again");
      setSubmitting(false);
      return;
    }
    const result = data as { order_id: string; access_token: string };
    setCart([]);
    setShowCart(false);
    setSubmitting(false);
    toast.success("Order sent to the kitchen!");
    navigate({
      to: "/t/$token/order/$orderId",
      params: { token, orderId: result.order_id },
      search: { k: result.access_token },
    });
  }


  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading menu…
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Table not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This QR code isn't linked to an active table. Please ask your server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-28 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <ChefHat className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">{restaurant?.name ?? "Menu"}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Table {table?.label} · Live menu</div>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Live
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        <div className="mb-6 rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">Welcome to {restaurant?.name}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Availability updates in real time — if an item goes grey, the kitchen just 86'd it.
              </p>
            </div>
          </div>
        </div>

        {grouped.map(({ category, items: catItems }) => (
          <section key={category.id} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{category.name}</h2>
            <div className="grid gap-3">
              {catItems.map((item) => (
                <Card
                  key={item.id}
                  className={`border-white/10 bg-card/70 p-4 backdrop-blur transition-all ${
                    item.is_available ? "hover:border-primary/30" : "opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${item.is_available ? "" : "line-through"}`}>
                          {item.name}
                        </span>
                        {!item.is_available && (
                          <Badge variant="outline" className="border-red-400/30 text-[10px] text-red-300">
                            86'd
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          ${(item.price_cents / 100).toFixed(2)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {item.prep_minutes}m
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!item.is_available}
                      onClick={() => addToCart(item)}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
              {catItems.length === 0 && (
                <p className="text-xs text-muted-foreground">Nothing in this section yet.</p>
              )}
            </div>
          </section>
        ))}
      </main>

      {/* Sticky cart bar */}
      {cartCount > 0 && !showCart && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto max-w-3xl px-5">
          <button
            onClick={() => setShowCart(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-2xl shadow-primary/30 transition-transform hover:scale-[1.01]"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="h-4 w-4" />
              Review order · {cartCount} {cartCount === 1 ? "item" : "items"}
            </span>
            <span className="font-semibold">${(cartTotal / 100).toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <Card className="max-h-[85vh] w-full max-w-xl overflow-hidden border-white/10 bg-card p-0 sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="font-semibold">Your order</div>
                <div className="text-xs text-muted-foreground">Table {table?.label}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto px-5 py-3">
              {cart.map((l) => (
                <div key={l.item.id} className="border-b border-white/5 py-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{l.item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ${(l.item.price_cents / 100).toFixed(2)} each
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" onClick={() => updateQty(l.item.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{l.qty}</span>
                      <Button size="icon" variant="outline" onClick={() => updateQty(l.item.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Notes (allergies, no onion…)"
                    value={l.notes ?? ""}
                    onChange={(e) => updateNotes(l.item.id, e.target.value)}
                    className="mt-2 h-16 resize-none border-white/10 bg-background/50 text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 bg-background/50 px-5 py-4">
              <Input
                placeholder="Your name (optional)"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="mb-3 border-white/10 bg-background/50"
              />
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-semibold">${(cartTotal / 100).toFixed(2)}</span>
              </div>
              <Button
                onClick={placeOrder}
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {submitting ? "Sending…" : "Send to kitchen"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
