import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Receipt, Heart, CalendarCheck, Sparkles, CreditCard, MapPin, UtensilsCrossed } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRewards } from "@/components/rewards/useRewards";
import { useGuestPrefs } from "@/lib/guest-prefs";
import { GuestHeader } from "@/components/guest/GuestHeader";
import { GuestFooter } from "@/components/guest/GuestFooter";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — orders, favourites & rewards | Occupancy" },
      { name: "description", content: "Your Occupancy guest profile: order history, favourite dishes, saved reservations, loyalty points and payment preferences." },
      { property: "og:title", content: "My profile — Occupancy" },
      { property: "og:description", content: "Order history, favourites, saved reservations and loyalty points in one place." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type OrderRow = { id: string; created_at: string; status: string; total_cents: number | null };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function ProfilePage() {
  const { status, user } = useAuth();
  const { state } = useRewards();
  const { prefs, update, toggleFavorite } = useGuestPrefs();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setOrders([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("orders")
      .select("id,created_at,status,total_cents")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) setOrders((data as OrderRow[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} aria-hidden="true" />
      <GuestHeader />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-lg font-bold text-primary">
              {(user?.email ?? "G").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{user?.email ?? "Guest"}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {state.balance.toLocaleString()} points · {state.streak}-day streak
              </p>
            </div>
          </div>
          <Button asChild className="press shrink-0"><Link to="/rewards">Rewards hub</Link></Button>
        </header>

        <Tabs defaultValue="orders" className="mt-8">
          <TabsList className="no-scrollbar w-full justify-start overflow-x-auto">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="favorites">Favourites</TabsTrigger>
            <TabsTrigger value="reservations">Reservations</TabsTrigger>
            <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
            <TabsTrigger value="settings">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-6">
            {orders === null ? (
              <div className="skeleton-shine h-40 rounded-2xl border border-white/10 bg-surface/40" aria-hidden="true" />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No orders yet"
                message={status === "authenticated" ? "Scan the QR code at your table and your tickets will appear here." : "Sign in to sync your order history across devices."}
                action={status === "authenticated" ? { label: "Browse the menu", href: "/our-menu" } : { label: "Sign in", href: "/auth" }}
              />
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Card className="row-hover flex items-center justify-between gap-4 border-white/10 bg-card/60 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">Order #{o.id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant="secondary" className="capitalize">{o.status}</Badge>
                        <span className="font-semibold text-primary">{money(o.total_cents ?? 0)}</span>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="mt-6">
            {prefs.favorites.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No favourites saved"
                message="Tap the heart on any dish to keep it here for your next visit."
                action={{ label: "Explore the menu", href: "/our-menu" }}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {prefs.favorites.map((f) => (
                  <Card key={f.id} className="flex items-center justify-between gap-3 border-white/10 bg-card/60 p-4">
                    <span className="min-w-0 truncate text-sm font-medium">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-primary">{money(f.price_cents)}</span>
                      <Button size="sm" variant="ghost" onClick={() => toggleFavorite(f)}>Remove</Button>
                    </span>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reservations" className="mt-6">
            {prefs.reservations.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No saved reservations"
                message="Book a table and it'll show up here with the date, party size and seating you chose."
                action={{ label: "Reserve a table", href: "/book" }}
              />
            ) : (
              <ul className="space-y-3">
                {prefs.reservations.map((r) => (
                  <li key={r.id}>
                    <Card className="flex items-center justify-between gap-4 border-white/10 bg-card/60 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{r.when}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.name} · party of {r.party} · {r.seating}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">Confirmed</Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="loyalty" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Point balance", value: state.balance.toLocaleString(), icon: Sparkles },
                { label: "Lifetime earned", value: state.lifetime.toLocaleString(), icon: Sparkles },
                { label: "Active vouchers", value: String(state.vouchers.filter((v) => !v.used).length), icon: Receipt },
              ].map((s) => (
                <Card key={s.label} className="border-white/10 bg-card/60 p-5">
                  <s.icon className="h-5 w-5 text-primary" />
                  <div className="mt-3 text-2xl font-bold">{s.value}</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </Card>
              ))}
            </div>
            <Button asChild className="press mt-5"><Link to="/rewards">Open rewards hub</Link></Button>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 space-y-6">
            <Card className="border-white/10 bg-card/60 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <CreditCard className="h-4 w-4 text-primary" /> Preferred payment method
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["card", "upi", "wallet", "cash"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={prefs.paymentMethod === m}
                    onClick={() => update({ paymentMethod: m })}
                    className={`press rounded-xl border px-4 py-2 text-sm capitalize transition-colors ${
                      prefs.paymentMethod === m ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-surface/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Used to pre-select your method at the table. Nothing is charged here.</p>
            </Card>

            <Card className="border-white/10 bg-card/60 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" /> Saved addresses
              </h2>
              <EmptyState
                className="mt-4"
                icon={UtensilsCrossed}
                title="Delivery is coming soon"
                message="Save an address once takeaway and delivery go live at Occupancy Demo Kitchen."
              />
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <GuestFooter />
    </div>
  );
}
