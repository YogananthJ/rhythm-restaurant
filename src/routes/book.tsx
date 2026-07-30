import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, CheckCircle2, Users, Phone, Mail, StickyNote } from "lucide-react";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Reserve a table — Occupancy Demo Kitchen" },
      { name: "description", content: "Book a table at Occupancy Demo Kitchen. Instant confirmation from the host stand." },
      { property: "og:title", content: "Reserve a table — Occupancy" },
      { property: "og:description", content: "Book in seconds. The host stand sees your request the moment you submit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookPage,
});

type Restaurant = { id: string; name: string };

function BookPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string; when: string; party: number } | null>(null);

  const defaults = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return iso;
  }, []);

  const [form, setForm] = useState({
    guest_name: "",
    phone: "",
    email: "",
    party_size: 2,
    requested_at: defaults,
    notes: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("restaurants").select("id,name").limit(1).maybeSingle();
      if (data) setRestaurant(data as Restaurant);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    if (!form.guest_name.trim()) return toast.error("Please enter a name for the booking");
    if (!form.requested_at) return toast.error("Pick a date & time");
    const when = new Date(form.requested_at);
    if (Number.isNaN(when.getTime())) return toast.error("Invalid date");
    if (when.getTime() < Date.now() - 30 * 60 * 1000) return toast.error("Pick a future time");

    setBusy(true);

    // Capacity check before inserting
    const { data: cap, error: capErr } = await supabase.rpc("check_reservation_capacity", {
      p_restaurant_id: restaurant.id,
      p_requested_at: when.toISOString(),
      p_party_size: form.party_size,
    });
    if (capErr) {
      setBusy(false);
      return toast.error(capErr.message);
    }
    const capacity = cap as { seats_available: number; can_book: boolean; total_seats: number } | null;
    if (capacity && !capacity.can_book) {
      setBusy(false);
      return toast.error(
        `Sorry — only ${capacity.seats_available} seats free within 90 min of that time. Try a different slot.`,
      );
    }

    const { error } = await supabase
      .from("reservations")
      .insert({
        restaurant_id: restaurant.id,
        guest_name: form.guest_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        party_size: form.party_size,
        requested_at: when.toISOString(),
        notes: form.notes.trim() || null,
        status: "pending",
      });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConfirmed({ when: when.toLocaleString(), party: form.party_size });
    toast.success("Reservation confirmed instantly");
  }

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-1.5 h-4 w-4" /> Home</Link>
          </Button>
          <Badge variant="secondary" className="gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Live host stand
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <CalendarClock className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Reserve at <span className="text-gradient-primary">{restaurant?.name ?? "Occupancy"}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your request lands on the host stand the moment you submit. Confirmation follows in minutes.
          </p>
        </div>

        {confirmed ? (
          <Card className="border-primary/30 bg-primary/5 p-8 text-center backdrop-blur">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h2 className="text-xl font-semibold">Request received</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Table for {confirmed.party} · {confirmed.when}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Ref: {confirmed.id.slice(0, 8).toUpperCase()}</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setConfirmed(null)}>Book another</Button>
              <Button asChild>
                <Link to="/">Back home</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur sm:p-8">
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label>Full name</Label>
                <Input
                  placeholder="e.g. Alex Morgan"
                  value={form.guest_name}
                  onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                  required
                  maxLength={80}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label icon={<Users className="h-3.5 w-3.5" />}>Party size</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.party_size}
                    onChange={(e) => setForm({ ...form, party_size: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                  />
                </div>
                <div>
                  <Label icon={<CalendarClock className="h-3.5 w-3.5" />}>Date & time</Label>
                  <Input
                    type="datetime-local"
                    value={form.requested_at}
                    onChange={(e) => setForm({ ...form, requested_at: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label icon={<Phone className="h-3.5 w-3.5" />}>Phone</Label>
                  <Input
                    type="tel"
                    placeholder="+1 555 555 5555"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label icon={<Mail className="h-3.5 w-3.5" />}>Email <span className="text-muted-foreground/70">(optional)</span></Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label icon={<StickyNote className="h-3.5 w-3.5" />}>Special requests</Label>
                <Input
                  placeholder="Allergies, occasion, seating preference…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  maxLength={280}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={busy || !restaurant}>
                {busy ? "Sending…" : "Request table"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                By booking you agree to a 15-minute grace period. No card required.
              </p>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}

function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}
