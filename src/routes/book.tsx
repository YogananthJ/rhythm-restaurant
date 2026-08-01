import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, CheckCircle2, Users, Phone, Mail, StickyNote } from "lucide-react";
import { Illustration } from "@/components/Illustration";
import { SuccessScreen } from "@/components/SuccessScreen";
import { saveReservation } from "@/lib/guest-prefs";
import diningIllustration from "@/assets/illus-hero.jpg";

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
  const [confirmed, setConfirmed] = useState<{ when: string; party: number; seating: string } | null>(null);
  const [availability, setAvailability] = useState<{ seats_available: number; total_seats: number; can_book: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

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
    seating: "any" as "any" | "indoor" | "outdoor",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("restaurants").select("id,name").limit(1).maybeSingle();
      if (data) setRestaurant(data as Restaurant);
    })();
  }, []);

  // Live availability preview for the chosen slot
  useEffect(() => {
    if (!restaurant || !form.requested_at) return;
    const when = new Date(form.requested_at);
    if (Number.isNaN(when.getTime())) return;
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("check_reservation_capacity", {
        p_restaurant_id: restaurant.id,
        p_requested_at: when.toISOString(),
        p_party_size: form.party_size,
      });
      if (!cancelled) {
        setAvailability((data as { seats_available: number; total_seats: number; can_book: boolean } | null) ?? null);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [restaurant, form.requested_at, form.party_size]);

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

    const { error } = await supabase.rpc("create_public_reservation", {
      p_restaurant_id: restaurant.id,
      p_guest_name: form.guest_name.trim(),
      p_phone: form.phone.trim() || null,
      p_email: form.email.trim() || null,
      p_party_size: form.party_size,
      p_requested_at: when.toISOString(),
      p_notes:
        [form.seating !== "any" ? `Seating: ${form.seating}` : null, form.notes.trim() || null]
          .filter(Boolean)
          .join(" · ") || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const seatingLabel = form.seating === "any" ? "Any seating" : form.seating === "indoor" ? "Indoor" : "Outdoor";
    setConfirmed({ when: when.toLocaleString(), party: form.party_size, seating: seatingLabel });
    saveReservation({
      id: crypto.randomUUID(),
      when: when.toLocaleString(),
      party: form.party_size,
      seating: seatingLabel,
      name: form.guest_name.trim(),
      notes: form.notes.trim() || undefined,
    });
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
        <Illustration
          src={diningIllustration}
          alt="Illustration of a warmly lit restaurant dining room ready for guests"
          width={1280}
          height={960}
          className="mb-8"
        />
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
          <SuccessScreen
            title="Reservation confirmed"
            message="Your table is on the host stand. We hold it for 15 minutes past your booking time."
            details={[
              { label: "When", value: confirmed.when },
              { label: "Party", value: `${confirmed.party} guest${confirmed.party === 1 ? "" : "s"}` },
              { label: "Seating", value: confirmed.seating },
            ]}
          >
            <Button variant="outline" onClick={() => setConfirmed(null)}>Book another</Button>
            <Button asChild><Link to="/profile">View in my profile</Link></Button>
            <Button asChild variant="ghost"><Link to="/our-menu">Browse the menu</Link></Button>
          </SuccessScreen>
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
                <Label>Seating preference</Label>
                <div className="flex flex-wrap gap-2">
                  {(["any", "indoor", "outdoor"] as const).map((sIt) => (
                    <button
                      key={sIt}
                      type="button"
                      aria-pressed={form.seating === sIt}
                      onClick={() => setForm({ ...form, seating: sIt })}
                      className={`press rounded-xl border px-4 py-2 text-sm capitalize transition-colors ${
                        form.seating === sIt
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-white/10 bg-surface/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {sIt === "any" ? "No preference" : sIt}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="rounded-xl border border-white/10 bg-surface/40 px-4 py-3 text-sm"
                aria-live="polite"
              >
                {checking && <span className="text-muted-foreground">Checking live table availability…</span>}
                {!checking && availability && (
                  availability.can_book ? (
                    <span className="text-primary">
                      {availability.seats_available} of {availability.total_seats} seats free around that time — your table is available.
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Only {availability.seats_available} seats free within 90 minutes of that slot. Try another time.
                    </span>
                  )
                )}
                {!checking && !availability && <span className="text-muted-foreground">Pick a date & time to see live availability.</span>}
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
