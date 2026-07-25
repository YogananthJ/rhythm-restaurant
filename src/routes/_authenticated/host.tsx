import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChefHat, Users, Clock, BellRing, Trash2, ArrowLeft, UserPlus, CalendarClock, CheckCircle2, XCircle } from "lucide-react";

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
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [form, setForm] = useState({ guest_name: "", party_size: 2, phone: "", quoted_minutes: 15, notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bootstrap();
    const ch = supabase
      .channel("host-waitlist")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, loadTables)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  async function bootstrap() {
    const { data: rest } = await supabase.from("restaurants").select("id").limit(1).maybeSingle();
    if (rest?.id) setRestaurantId(rest.id);
    await Promise.all([load(), loadTables()]);
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
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
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
