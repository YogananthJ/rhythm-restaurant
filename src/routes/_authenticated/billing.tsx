import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatCents, toCents } from "@/lib/money";
import { BillingDialog } from "@/components/BillingDialog";
import { ArrowLeft, Receipt, Tag, Download, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";

type PayRow = { id: string; order_id: string; method: string; amount_cents: number; tip_cents: number; txn_ref: string | null; created_at: string; restaurant_id: string };
type OrderRow = { id: string; invoice_no: string | null; guest_name: string | null; total_cents: number; status: string; closed_at: string | null; created_at: string; table_id: string | null };
type Coupon = { id: string; code: string; kind: string; value: number; active: boolean; uses: number; max_uses: number | null; expires_at: string | null; min_subtotal_cents: number; restaurant_id: string };

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Occupancy" },
      { name: "description", content: "Invoices, payments, coupons and daily revenue." },
      { property: "og:title", content: "Billing — Occupancy" },
      { property: "og:description", content: "Restaurant billing and revenue center." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [openOrders, setOpenOrders] = useState<OrderRow[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [dialogOrderId, setDialogOrderId] = useState<string | null>(null);

  // Coupon form
  const [cCode, setCCode] = useState("");
  const [cKind, setCKind] = useState<"percent" | "fixed">("percent");
  const [cVal, setCVal] = useState("");
  const [cMin, setCMin] = useState("");

  const load = useCallback(async () => {
    const r = await supabase.from("restaurants").select("id,currency").limit(1).maybeSingle();
    if (!r.data) return;
    setRestaurantId(r.data.id); setCurrency(r.data.currency);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [pm, os, oo, cp] = await Promise.all([
      supabase.from("payments").select("*").eq("restaurant_id", r.data.id).gte("created_at", start.toISOString()).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,invoice_no,guest_name,total_cents,status,closed_at,created_at,table_id").eq("restaurant_id", r.data.id).gte("closed_at", start.toISOString()).order("closed_at", { ascending: false }),
      supabase.from("orders").select("id,invoice_no,guest_name,total_cents,status,closed_at,created_at,table_id").eq("restaurant_id", r.data.id).not("status", "in", "(paid,closed,cancelled)").order("created_at", { ascending: false }),
      supabase.from("coupons").select("*").eq("restaurant_id", r.data.id).order("created_at", { ascending: false }),
    ]);
    setPayments((pm.data as PayRow[]) ?? []);
    setOrders((os.data as OrderRow[]) ?? []);
    setOpenOrders((oo.data as OrderRow[]) ?? []);
    setCoupons((cp.data as Coupon[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel("billing_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, load]);

  const revenue = useMemo(() => payments.reduce((s, p) => s + p.amount_cents, 0), [payments]);
  const tips = useMemo(() => payments.reduce((s, p) => s + p.tip_cents, 0), [payments]);
  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    payments.forEach((p) => { m[p.method] = (m[p.method] ?? 0) + p.amount_cents; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [payments]);
  const byHour = useMemo(() => {
    const h: Record<string, number> = {};
    payments.forEach((p) => {
      const hr = new Date(p.created_at).getHours().toString().padStart(2, "0") + ":00";
      h[hr] = (h[hr] ?? 0) + p.amount_cents;
    });
    return Object.entries(h).sort(([a], [b]) => a.localeCompare(b)).map(([hour, cents]) => ({ hour, revenue: cents / 100 }));
  }, [payments]);

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#64748b"];

  const createCoupon = async () => {
    if (!cCode.trim() || !cVal) { toast.error("Code and value required"); return; }
    const { error } = await supabase.from("coupons").insert({
      restaurant_id: restaurantId, code: cCode.trim().toUpperCase(), kind: cKind,
      value: parseFloat(cVal), min_subtotal_cents: toCents(cMin || "0"), active: true,
    });
    if (error) toast.error(error.message); else {
      toast.success("Coupon created"); setCCode(""); setCVal(""); setCMin("");
    }
  };
  const toggleCoupon = async (c: Coupon) => {
    const { error } = await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    if (error) toast.error(error.message);
  };
  const deleteCoupon = async (id: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  const exportCSV = () => {
    const rows = [
      ["When", "Order", "Invoice", "Method", "Amount", "Tip", "Ref"],
      ...payments.map((p) => {
        const o = orders.find((x) => x.id === p.order_id);
        return [new Date(p.created_at).toLocaleString(), p.order_id.slice(0, 8), o?.invoice_no ?? "", p.method,
          (p.amount_cents / 100).toFixed(2), (p.tip_cents / 100).toFixed(2), p.txn_ref ?? ""];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" asChild><Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" />Dashboard</Link></Button>
            <h1 className="text-lg font-semibold">Billing</h1>
          </div>
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon={<DollarSign />} label="Today's revenue" value={formatCents(revenue, currency)} />
          <Kpi icon={<DollarSign />} label="Tips" value={formatCents(tips, currency)} />
          <Kpi icon={<Receipt />} label="Invoices" value={String(orders.filter((o) => o.status === "paid").length)} />
          <Kpi icon={<Receipt />} label="Open tickets" value={String(openOrders.length)} />
        </div>

        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="open">Open tickets</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 border-white/10 bg-card/70">
              <div className="mb-2 text-sm font-semibold">Revenue by hour</div>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={byHour}>
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 border-white/10 bg-card/70">
              <div className="mb-2 text-sm font-semibold">Payment methods</div>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byMethod} dataKey="value" nameKey="name" outerRadius={80} label={(e) => `${e.name} ${formatCents(e.value as number, currency)}`}>
                      {byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCents(v, currency)} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="open">
            <Card className="border-white/10 bg-card/70">
              {openOrders.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No open tickets</div> :
                openOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between border-b border-white/5 p-3 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{o.guest_name ?? "Guest"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()} · {o.status}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{formatCents(o.total_cents, currency)}</span>
                      <Button size="sm" onClick={() => setDialogOrderId(o.id)}>Bill</Button>
                    </div>
                  </div>
                ))}
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card className="border-white/10 bg-card/70">
              {orders.filter((o) => o.status === "paid").length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No invoices today</div> :
                orders.filter((o) => o.status === "paid").map((o) => (
                  <div key={o.id} className="flex items-center justify-between border-b border-white/5 p-3 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{o.invoice_no} · {o.guest_name ?? "Guest"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.closed_at ?? o.created_at).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{formatCents(o.total_cents, currency)}</span>
                      <Button size="sm" variant="outline" onClick={() => setDialogOrderId(o.id)}>Reprint</Button>
                    </div>
                  </div>
                ))}
            </Card>
          </TabsContent>

          <TabsContent value="coupons" className="space-y-4">
            <Card className="p-4 border-white/10 bg-card/70">
              <div className="mb-3 text-sm font-semibold">Create coupon</div>
              <div className="grid gap-2 md:grid-cols-5">
                <div><Label>Code</Label><Input value={cCode} onChange={(e) => setCCode(e.target.value.toUpperCase())} placeholder="HAPPY20" /></div>
                <div><Label>Kind</Label>
                  <Select value={cKind} onValueChange={(v) => setCKind(v as "percent" | "fixed")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percent">Percent %</SelectItem><SelectItem value="fixed">Fixed {currency}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="number" step="0.01" value={cVal} onChange={(e) => setCVal(e.target.value)} /></div>
                <div><Label>Min subtotal ({currency})</Label><Input type="number" step="0.01" value={cMin} onChange={(e) => setCMin(e.target.value)} /></div>
                <div className="flex items-end"><Button onClick={createCoupon} className="w-full"><Tag className="mr-1 h-4 w-4" />Add</Button></div>
              </div>
            </Card>
            <Card className="border-white/10 bg-card/70">
              {coupons.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No coupons yet</div> :
                coupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b border-white/5 p-3 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{c.code} <Badge variant={c.active ? "default" : "secondary"} className="ml-2">{c.kind === "percent" ? `${c.value}%` : formatCents(Math.round(c.value * 100), currency)}</Badge></div>
                      <div className="text-xs text-muted-foreground">Used {c.uses}{c.max_uses ? `/${c.max_uses}` : ""} · Min {formatCents(c.min_subtotal_cents, currency)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={c.active} onCheckedChange={() => toggleCoupon(c)} />
                      <Button size="sm" variant="ghost" onClick={() => deleteCoupon(c.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <BillingDialog orderId={dialogOrderId} open={!!dialogOrderId} onOpenChange={(o) => !o && setDialogOrderId(null)} onClosed={load} />
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-card/70 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}
