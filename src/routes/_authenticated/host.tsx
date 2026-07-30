import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChefHat, Users, Clock, BellRing, Trash2, ArrowLeft, UserPlus, CalendarClock, CheckCircle2, XCircle, DoorOpen, LogIn } from "lucide-react";

type WaitEntry = {
  id: string;
  guest_name: string;
  party_size: number;
  phone: string | null;
  notes: string | null;
  quoted_minutes: number;
  status: string;
  seated_table_id: string | null;
  created_at: string;
};

type DiningTable = { id: string; label: string; seats: number; status: string };

type Reservation = {
  id: string;
  guest_name: string;
  phone: string | null;
  email: string | null;
  party_size: number;
  requested_at: string;
  status: string;
  notes: string | null;
  table_id: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/host")({
  head: () => ({
    meta: [
      { title: "Host queue — Occupancy" },
      { name: "description", content: "Live waitlist for the host stand: add walk-ins, notify, and seat guests." },
      { property: "og:title", content: "Host queue — Occupancy" },
      { property: "og:description", content: "Manage the door in real time." },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const [entries, setEntries] = useState<WaitEntry[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [form, setForm] = useState({ guest_name: "", party_size: 2, phone: "", quoted_minutes: 15, notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bootstrap();
    const ch = supabase
      .channel("host-waitlist")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, loadTables)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadReservations)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  async function bootstrap() {
    const { data: rest } = await supabase.from("restaurants").select("id").limit(1).maybeSingle();
    if (rest?.id) setRestaurantId(rest.id);
    await Promise.all([load(), loadTables(), loadReservations()]);
  }

  async function load() {
    const { data } = await supabase
      .from("waitlist")
      .select("*")
      .in("status", ["waiting", "notified"])
      .order("created_at", { ascending: true });
    if (data) setEntries(data as WaitEntry[]);
  }

  async function loadTables() {
    const { data } = await supabase.from("dining_tables").select("*").order("label");
    if (data) setTables(data as DiningTable[]);
  }

  async function loadReservations() {
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .in("status", ["pending", "confirmed"])
      .gte("requested_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
      .order("requested_at", { ascending: true })
      .limit(50);
    if (data) setReservations(data as Reservation[]);
  }

  async function updateReservation(id: string, patch: Partial<Reservation>, msg: string) {
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg);
  }

  async function seatReservation(r: Reservation, tableId: string) {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "seated", table_id: tableId })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase.from("dining_tables").update({ status: "seated" }).eq("id", tableId);
    toast.success(`Seated ${r.guest_name}`);
  }

  function pickBestTable(partySize: number, preferredId: string | null): DiningTable | null {
    if (preferredId) {
      const preferred = tables.find((t) => t.id === preferredId);
      if (preferred && preferred.status === "available" && preferred.seats >= partySize) return preferred;
    }
    const fits = tables
      .filter((t) => t.status === "available" && t.seats >= partySize)
      .sort((a, b) => a.seats - b.seats);
    return fits[0] ?? null;
  }

  async function checkInReservation(r: Reservation) {
    const table = pickBestTable(r.party_size, r.table_id);
    if (!table) {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "confirmed" })
        .eq("id", r.id);
      if (error) return toast.error(error.message);
      toast(`${r.guest_name} checked in — no table open yet, holding at door`);
      return;
    }
    const { error } = await supabase
      .from("reservations")
      .update({ status: "seated", table_id: table.id })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase.from("dining_tables").update({ status: "seated" }).eq("id", table.id);
    toast.success(`${r.guest_name} checked in · seated at ${table.label}`);
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;
    if (!form.guest_name.trim()) {
      toast.error("Guest name required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("waitlist").insert({
      restaurant_id: restaurantId,
      guest_name: form.guest_name.trim(),
      party_size: form.party_size,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      quoted_minutes: form.quoted_minutes,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${form.guest_name} added — quoted ${form.quoted_minutes}m`);
    setForm({ guest_name: "", party_size: 2, phone: "", quoted_minutes: 15, notes: "" });
  }

  async function notify(entry: WaitEntry) {
    const { error } = await supabase.from("waitlist").update({ status: "notified" }).eq("id", entry.id);
    if (error) return toast.error(error.message);
    toast.success(`Pinged ${entry.guest_name}`);
  }

  async function seat(entry: WaitEntry, tableId: string) {
    const { error } = await supabase
      .from("waitlist")
      .update({ status: "seated", seated_table_id: tableId })
      .eq("id", entry.id);
    if (error) return toast.error(error.message);
    await supabase.from("dining_tables").update({ status: "seated" }).eq("id", tableId);
    toast.success(`Seated ${entry.guest_name}`);
  }

  async function remove(entry: WaitEntry) {
    const { error } = await supabase.from("waitlist").update({ status: "left" }).eq("id", entry.id);
    if (error) return toast.error(error.message);
    toast(`Removed ${entry.guest_name} from queue`);
  }

  const availableTables = useMemo(() => tables.filter((t) => t.status === "available"), [tables]);
  const waiting = entries.filter((e) => e.status === "waiting").length;
  const notified = entries.filter((e) => e.status === "notified").length;
  const avgWait = entries.length
    ? Math.round(entries.reduce((s, e) => s + minutesSince(e.created_at), 0) / entries.length)
    : 0;

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Floor</Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <ChefHat className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">Host queue</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">Walk-ins, waits & seating</div>
              </div>
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

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={<Users className="h-4 w-4" />} label="Waiting" value={String(waiting)} />
          <Stat icon={<BellRing className="h-4 w-4" />} label="Notified" value={String(notified)} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Avg wait" value={`${avgWait}m`} />
        </div>

        <CheckInPanel
          reservations={reservations}
          tables={tables}
          onCheckIn={checkInReservation}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Add walk-in</h2>
            </div>
            <form className="space-y-3" onSubmit={addEntry}>
              <Input
                placeholder="Guest name"
                value={form.guest_name}
                onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">
                  Party size
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.party_size}
                    onChange={(e) => setForm({ ...form, party_size: Math.max(1, Number(e.target.value) || 1) })}
                    className="mt-1"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Quote (min)
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={form.quoted_minutes}
                    onChange={(e) => setForm({ ...form, quoted_minutes: Math.max(0, Number(e.target.value) || 0) })}
                    className="mt-1"
                  />
                </label>
              </div>
              <Input
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                placeholder="Notes (allergies, high chair…)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Adding…" : "Add to queue"}
              </Button>
            </form>
          </Card>

          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Queue</h2>
              <span className="text-xs text-muted-foreground">
                {availableTables.length} table{availableTables.length === 1 ? "" : "s"} open
              </span>
            </div>

            {entries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 py-12 text-center text-sm text-muted-foreground">
                Queue is clear. Add a walk-in on the left.
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((e) => (
                  <div key={e.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{e.guest_name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            party of {e.party_size}
                          </Badge>
                          {e.status === "notified" && (
                            <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px] uppercase">
                              Notified
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>Waiting {minutesSince(e.created_at)}m · quoted {e.quoted_minutes}m</span>
                          {e.phone && <span>· {e.phone}</span>}
                        </div>
                        {e.notes && (
                          <div className="mt-1 text-xs italic text-muted-foreground">"{e.notes}"</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {e.status === "waiting" && (
                          <Button size="sm" variant="outline" onClick={() => notify(e)}>
                            <BellRing className="mr-1.5 h-3.5 w-3.5" /> Notify
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableTables.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No open tables — cycle one on the floor.</span>
                      ) : (
                        availableTables
                          .filter((t) => t.seats >= e.party_size - 1)
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => seat(e, t.id)}
                              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20"
                            >
                              Seat at {t.label} · {t.seats}
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="mt-8 border-white/10 bg-card/70 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-accent" />
              <h2 className="text-lg font-semibold">Reservations</h2>
              <Badge variant="outline" className="text-[10px] uppercase">
                {reservations.filter((r) => r.status === "pending").length} pending
              </Badge>
            </div>
            <a
              href="/book"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Public booking page ↗
            </a>
          </div>

          {reservations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-muted-foreground">
              No upcoming reservations. Share <span className="font-mono text-foreground">/book</span> to take one.
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => {
                const when = new Date(r.requested_at);
                const mins = Math.round((when.getTime() - Date.now()) / 60000);
                const timeLabel =
                  mins < 0 ? `${-mins}m ago` : mins < 60 ? `in ${mins}m` : when.toLocaleString();
                return (
                  <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.guest_name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">party of {r.party_size}</Badge>
                          {r.status === "pending" ? (
                            <Badge className="border-yellow-400/30 bg-yellow-400/15 text-yellow-300 text-[10px] uppercase">
                              Pending
                            </Badge>
                          ) : (
                            <Badge className="border-primary/30 bg-primary/15 text-primary text-[10px] uppercase">
                              Confirmed
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{timeLabel}</span>
                          <span className="text-muted-foreground/60">·</span>
                          <span>{when.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                          {r.phone && <span>· {r.phone}</span>}
                          {r.email && <span>· {r.email}</span>}
                        </div>
                        {r.notes && <div className="mt-1 text-xs italic text-muted-foreground">"{r.notes}"</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => checkInReservation(r)}>
                          <LogIn className="mr-1.5 h-3.5 w-3.5" /> Check in
                        </Button>
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => updateReservation(r.id, { status: "confirmed" }, `Confirmed ${r.guest_name}`)}>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => updateReservation(r.id, { status: "cancelled" }, `Cancelled ${r.guest_name}`)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableTables.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No open tables — cycle one on the floor.</span>
                      ) : (
                        availableTables
                          .filter((t) => t.seats >= r.party_size - 1)
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => seatReservation(r, t.id)}
                              className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-all hover:bg-accent/20"
                            >
                              Seat at {t.label} · {t.seats}
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function CheckInPanel({
  reservations,
  tables,
  onCheckIn,
}: {
  reservations: Reservation[];
  tables: DiningTable[];
  onCheckIn: (r: Reservation) => void;
}) {
  const now = Date.now();
  const arrivals = reservations
    .filter((r) => {
      const diff = (new Date(r.requested_at).getTime() - now) / 60000;
      return diff >= -30 && diff <= 60 && (r.status === "pending" || r.status === "confirmed");
    })
    .sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime());

  const openTables = tables.filter((t) => t.status === "available").length;

  return (
    <Card className="mt-8 border-white/10 bg-card/70 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Guest check-in</h2>
          <Badge variant="outline" className="text-[10px] uppercase">
            {arrivals.length} arriving
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {openTables} table{openTables === 1 ? "" : "s"} ready · auto-seats best fit
        </span>
      </div>

      {arrivals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground">
          No arrivals in the next hour. Reservations appear here 30m before their time.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {arrivals.map((r) => {
            const when = new Date(r.requested_at);
            const mins = Math.round((when.getTime() - now) / 60000);
            const overdue = mins < -5;
            const soon = mins <= 10 && mins >= -5;
            const label =
              mins < 0 ? `${-mins}m late` : mins === 0 ? "now" : `in ${mins}m`;
            const preferred = r.table_id ? tables.find((t) => t.id === r.table_id) : null;
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-4 transition-all ${
                  overdue
                    ? "border-destructive/40 bg-destructive/10"
                    : soon
                      ? "border-primary/40 bg-primary/10"
                      : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{r.guest_name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Party of {r.party_size} · {label}
                    </div>
                  </div>
                  <Badge
                    className={`text-[10px] uppercase ${
                      overdue
                        ? "border-destructive/30 bg-destructive/15 text-destructive"
                        : "border-primary/30 bg-primary/15 text-primary"
                    }`}
                  >
                    {when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </Badge>
                </div>
                {preferred && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Preferred: <span className="text-foreground">{preferred.label}</span>
                    {preferred.status !== "available" && " · busy"}
                  </div>
                )}
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => onCheckIn(r)}
                >
                  <LogIn className="mr-1.5 h-3.5 w-3.5" /> Mark arrived & seat
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
