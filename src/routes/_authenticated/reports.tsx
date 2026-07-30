import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  TrendingUp,
  Package,
  CalendarRange,
  Snowflake,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Sales Reports · Occupancy" },
      { name: "description", content: "Weekly, monthly, yearly & seasonal sales analytics with downloadable CSV reports." },
    ],
  }),
});

type OrderRow = {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  guest_name: string | null;
  table_id: string | null;
};

type ItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string;
  name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
  created_at: string;
};

type Granularity = "weekly" | "monthly" | "yearly";

// Only settled money counts as sales. Counting open tickets ("placed",
// "preparing", …) inflates reported revenue above what the till actually
// took, so end-of-day reconciliation never matches.
const REVENUE_STATUSES = new Set(["paid", "closed"]);

function isRevenue(o: OrderRow) {
  return REVENUE_STATUSES.has(o.status);
}

function seasonOf(d: Date): "Winter" | "Spring" | "Summer" | "Fall" {
  const m = d.getMonth();
  if (m <= 1 || m === 11) return "Winter";
  if (m <= 4) return "Spring";
  if (m <= 7) return "Summer";
  return "Fall";
}

function bucketKey(d: Date, g: Granularity): string {
  const y = d.getFullYear();
  if (g === "yearly") return String(y);
  if (g === "monthly") return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  // weekly — ISO-ish: year + week number
  const start = new Date(y, 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  const week = Math.ceil((diff + start.getDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}

function bucketLabel(key: string, g: Granularity): string {
  if (g === "yearly") return key;
  if (g === "monthly") {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  }
  return key.replace(/-W/, " · W");
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("monthly");

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Pull 18 months of history — enough for weekly/monthly/yearly + seasonal
      const since = new Date();
      since.setMonth(since.getMonth() - 18);
      const [ordersRes, itemsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, total_cents, created_at, guest_name, table_id")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true })
          .limit(5000),
        supabase
          .from("order_items")
          .select("id, order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, created_at")
          .gte("created_at", since.toISOString())
          .limit(20000),
      ]);
      if (ordersRes.error) toast.error(ordersRes.error.message);
      if (itemsRes.error) toast.error(itemsRes.error.message);
      setOrders((ordersRes.data ?? []) as OrderRow[]);
      setItems((itemsRes.data ?? []) as ItemRow[]);
      setLoading(false);
    })();
  }, []);

  const revenueOrders = useMemo(() => orders.filter(isRevenue), [orders]);
  const revenueOrderIds = useMemo(() => new Set(revenueOrders.map((o) => o.id)), [revenueOrders]);
  const revenueItems = useMemo(
    () => items.filter((i) => revenueOrderIds.has(i.order_id)),
    [items, revenueOrderIds],
  );

  // ── Time-series revenue ──────────────────────────────────────────────
  const revenueSeries = useMemo(() => {
    const map = new Map<string, { key: string; label: string; revenue: number; orders: number }>();
    for (const o of revenueOrders) {
      const d = new Date(o.created_at);
      const key = bucketKey(d, granularity);
      const prev = map.get(key) ?? { key, label: bucketLabel(key, granularity), revenue: 0, orders: 0 };
      prev.revenue += o.total_cents / 100;
      prev.orders += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [revenueOrders, granularity]);

  // ── Product-wise (top 8) for current granularity ─────────────────────
  const productSeries = useMemo(() => {
    // aggregate quantity per product per bucket
    const perProductTotal = new Map<string, number>();
    const perBucketProduct = new Map<string, Map<string, number>>();
    const buckets: string[] = [];

    for (const it of revenueItems) {
      const d = new Date(it.created_at);
      const key = bucketKey(d, granularity);
      if (!perBucketProduct.has(key)) {
        perBucketProduct.set(key, new Map());
        buckets.push(key);
      }
      const bmap = perBucketProduct.get(key)!;
      bmap.set(it.name_snapshot, (bmap.get(it.name_snapshot) ?? 0) + it.quantity);
      perProductTotal.set(it.name_snapshot, (perProductTotal.get(it.name_snapshot) ?? 0) + it.quantity);
    }

    const top = Array.from(perProductTotal.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const orderedBuckets = Array.from(new Set(buckets)).sort();
    const rows = orderedBuckets.map((k) => {
      const row: Record<string, string | number> = { label: bucketLabel(k, granularity) };
      const bmap = perBucketProduct.get(k)!;
      for (const p of top) row[p] = bmap.get(p) ?? 0;
      return row;
    });

    return { rows, top };
  }, [revenueItems, granularity]);

  // ── Season-wise product performance ──────────────────────────────────
  const seasonal = useMemo(() => {
    const perSeason = new Map<string, Map<string, { qty: number; revenue: number }>>();
    for (const it of revenueItems) {
      const s = seasonOf(new Date(it.created_at));
      if (!perSeason.has(s)) perSeason.set(s, new Map());
      const pmap = perSeason.get(s)!;
      const prev = pmap.get(it.name_snapshot) ?? { qty: 0, revenue: 0 };
      prev.qty += it.quantity;
      prev.revenue += (it.quantity * it.unit_price_cents) / 100;
      pmap.set(it.name_snapshot, prev);
    }
    const order = ["Winter", "Spring", "Summer", "Fall"];
    return order.map((season) => {
      const pmap = perSeason.get(season) ?? new Map();
      const top5 = Array.from(pmap.entries())
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 5)
        .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }));
      const totalRevenue = Array.from(pmap.values()).reduce((s, v) => s + v.revenue, 0);
      const totalQty = Array.from(pmap.values()).reduce((s, v) => s + v.qty, 0);
      return { season, top5, totalRevenue, totalQty };
    });
  }, [revenueItems]);

  const totals = useMemo(() => {
    const revenue = revenueOrders.reduce((s, o) => s + o.total_cents, 0) / 100;
    const orderCount = revenueOrders.length;
    const items = revenueItems.reduce((s, i) => s + i.quantity, 0);
    const avg = orderCount ? revenue / orderCount : 0;
    return { revenue, orderCount, items, avg };
  }, [revenueOrders, revenueItems]);

  // ── Downloads ────────────────────────────────────────────────────────
  function downloadMonthlyReport() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const rows = revenueOrders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= monthStart && d < monthEnd;
    });
    if (rows.length === 0) return toast.info("No orders this month yet");

    const perDay = new Map<string, { orders: number; revenue: number }>();
    for (const o of rows) {
      const key = new Date(o.created_at).toISOString().slice(0, 10);
      const prev = perDay.get(key) ?? { orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += o.total_cents / 100;
      perDay.set(key, prev);
    }
    const csvRows = Array.from(perDay.entries())
      .sort()
      .map(([date, v]) => ({
        date,
        orders: v.orders,
        revenue_usd: v.revenue.toFixed(2),
        avg_ticket_usd: (v.revenue / v.orders).toFixed(2),
      }));
    const totalRev = rows.reduce((s, o) => s + o.total_cents, 0) / 100;
    csvRows.push({
      date: "TOTAL",
      orders: rows.length,
      revenue_usd: totalRev.toFixed(2),
      avg_ticket_usd: (totalRev / rows.length).toFixed(2),
    });
    const tag = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
    download(`monthly-sales-${tag}.csv`, toCsv(csvRows));
    toast.success(`Downloaded monthly report · ${tag}`);
  }

  function downloadFullSales() {
    const byOrder = new Map<string, ItemRow[]>();
    for (const it of revenueItems) {
      if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
      byOrder.get(it.order_id)!.push(it);
    }
    const rows = revenueOrders.map((o) => {
      const its = byOrder.get(o.id) ?? [];
      const qty = its.reduce((s, i) => s + i.quantity, 0);
      const summary = its.map((i) => `${i.quantity}x ${i.name_snapshot}`).join("; ");
      return {
        order_id: o.id,
        created_at: o.created_at,
        status: o.status,
        guest: o.guest_name ?? "",
        table_id: o.table_id ?? "",
        item_count: qty,
        items: summary,
        total_usd: (o.total_cents / 100).toFixed(2),
      };
    });
    if (rows.length === 0) return toast.info("Nothing to export yet");
    download(`sales-export-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    toast.success(`Exported ${rows.length} orders`);
  }

  function downloadProductBreakdown() {
    const rows: Array<Record<string, unknown>> = [];
    for (const s of seasonal) {
      for (const p of s.top5) {
        rows.push({
          season: s.season,
          product: p.name,
          units_sold: p.qty,
          revenue_usd: p.revenue.toFixed(2),
        });
      }
    }
    if (rows.length === 0) return toast.info("No product data yet");
    download(`seasonal-product-breakdown-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    toast.success("Downloaded seasonal breakdown");
  }

  const productColors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "#f59e0b",
    "#ec4899",
    "#8b5cf6",
    "#14b8a6",
    "#ef4444",
    "#3b82f6",
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-white/5 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Sales Reports</h1>
              <p className="text-xs text-muted-foreground">
                Weekly, monthly, yearly & seasonal analysis · downloadable CSVs
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={downloadMonthlyReport}>
              <FileText className="mr-1.5 h-4 w-4" /> Monthly report
            </Button>
            <Button size="sm" variant="outline" onClick={downloadProductBreakdown}>
              <Package className="mr-1.5 h-4 w-4" /> Seasonal products
            </Button>
            <Button size="sm" onClick={downloadFullSales}>
              <Download className="mr-1.5 h-4 w-4" /> Full sales export
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-sm text-muted-foreground">
            Loading 18 months of sales history…
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Revenue · 18mo" value={`$${totals.revenue.toFixed(2)}`} tone="primary" />
              <StatCard label="Orders" value={String(totals.orderCount)} tone="accent" />
              <StatCard label="Items sold" value={String(totals.items)} tone="muted" />
              <StatCard label="Avg ticket" value={`$${totals.avg.toFixed(2)}`} tone="primary" />
            </div>

            {/* Granularity toggle */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Grouping:</span>
                {(["weekly", "monthly", "yearly"] as Granularity[]).map((g) => (
                  <Button
                    key={g}
                    size="sm"
                    variant={granularity === g ? "default" : "outline"}
                    onClick={() => setGranularity(g)}
                    className="capitalize"
                  >
                    {g}
                  </Button>
                ))}
              </div>
              <Badge variant="outline" className="text-xs">
                {revenueSeries.length} {granularity === "weekly" ? "weeks" : granularity === "monthly" ? "months" : "years"}
              </Badge>
            </div>

            {/* Revenue chart */}
            <Card className="mt-4 border-white/10 bg-card/70 p-5 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Sales trend · {granularity}
                </h2>
              </div>
              {revenueSeries.length === 0 ? (
                <EmptyPanel />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer>
                    <AreaChart data={revenueSeries}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number, name: string) =>
                          name === "revenue" ? [`$${v.toFixed(2)}`, "Revenue"] : [v, name]
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#rev)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Product-wise chart */}
            <Card className="mt-6 border-white/10 bg-card/70 p-5 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Top products · {granularity}
                  </h2>
                </div>
                <span className="text-[11px] text-muted-foreground">units sold</span>
              </div>
              {productSeries.rows.length === 0 ? (
                <EmptyPanel />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer>
                    <BarChart data={productSeries.rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {productSeries.top.map((p, i) => (
                        <Bar key={p} dataKey={p} stackId="a" fill={productColors[i % productColors.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Seasonal breakdown */}
            <Card className="mt-6 border-white/10 bg-card/70 p-5 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Season-wise best sellers
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {seasonal.map((s) => (
                  <div key={s.season} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold">{s.season}</div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Revenue</div>
                        <div className="text-sm font-medium">${s.totalRevenue.toFixed(0)}</div>
                      </div>
                    </div>
                    {s.top5.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {s.top5.map((p) => {
                          const max = s.top5[0].qty || 1;
                          const pct = Math.round((p.qty / max) * 100);
                          return (
                            <li key={p.name} className="text-xs">
                              <div className="flex justify-between">
                                <span className="truncate pr-2">{p.name}</span>
                                <span className="text-muted-foreground">{p.qty}</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                                <div
                                  className="h-full rounded-full bg-primary/70"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "accent" | "muted";
}) {
  const t =
    tone === "primary"
      ? "border-primary/25 bg-primary/5"
      : tone === "accent"
        ? "border-accent/25 bg-accent/5"
        : "border-white/10 bg-white/[0.02]";
  return (
    <Card className={`p-5 backdrop-blur ${t}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}

function EmptyPanel() {
  return (
    <div className="py-14 text-center text-sm text-muted-foreground">
      No sales in the selected range yet. Once orders come in, charts populate live.
    </div>
  );
}
