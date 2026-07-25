import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  ChefHat,
  Clock,
  Filter,
  Gauge,
  History,
  LineChart as LineChartIcon,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Utensils,
  Wand2,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useServerFn } from "@tanstack/react-start";
import {
  generateIntelInsights,
  type IntelIncident,
  type IntelInsight,
  type IntelRecommendation,
} from "@/lib/intel.functions";

type Order = {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  updated_at: string;
  table_id: string | null;
  guest_name: string | null;
};
type OrderItem = {
  id: string;
  order_id: string;
  name_snapshot: string;
  quantity: number;
  status: string;
  unit_price_cents: number;
  created_at: string;
};
type DiningTable = { id: string; label: string; seats: number; status: string; updated_at: string };
type MenuItem = { id: string; name: string; is_available: boolean; prep_minutes: number; price_cents: number; updated_at: string };
type WaitEntry = { id: string; guest_name: string; party_size: number; status: string; quoted_minutes: number; created_at: string; updated_at: string; seated_table_id: string | null };
type Feedback = { id: string; order_id: string; rating: number; comment: string | null; sentiment: string | null; created_at: string };

type TimelineEvent = {
  ts: string;
  kind: "order" | "kitchen" | "table" | "waitlist" | "menu" | "close";
  label: string;
  detail: string;
  tableId?: string | null;
  orderId?: string | null;
};

type IncidentRow = {
  id: string;
  restaurant_id: string;
  fingerprint: string;
  title: string;
  priority: "low" | "medium" | "high";
  root_cause: string;
  business_impact: string;
  action: string;
  status: "open" | "dismissed" | "resolved";
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

function fingerprintIncident(title: string) {
  return title.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 180);
}

const ACTIVE_STATUSES = new Set(["placed", "preparing", "ready"]);

export const Route = createFileRoute("/_authenticated/intel")({
  head: () => ({
    meta: [
      { title: "Intelligence Center — Occupancy" },
      { name: "description", content: "Live restaurant health score, AI ops feed, incidents, replay timeline, and predictive analytics." },
      { property: "og:title", content: "Intelligence Center — Occupancy" },
      { property: "og:description", content: "Mission control for the restaurant floor." },
    ],
  }),
  component: IntelPage,
});

function IntelPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ai, setAi] = useState<{ feed: IntelInsight[]; incidents: IntelIncident[]; recommendations: IntelRecommendation[] } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [dbIncidents, setDbIncidents] = useState<IncidentRow[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"today" | "hour" | "table" | "order">("today");
  const [filterValue, setFilterValue] = useState<string>("");
  const lastAiRef = useRef<number>(0);
  const runInsights = useServerFn(generateIntelInsights);

  const loadAll = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [ordersRes, itemsRes, tablesRes, menuRes, waitRes] = await Promise.all([
      supabase.from("orders").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("order_items").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("dining_tables").select("*").order("label"),
      supabase.from("menu_items").select("*").order("name"),
      supabase.from("waitlist").select("*").gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as Order[]);
    if (itemsRes.data) setItems(itemsRes.data as OrderItem[]);
    if (tablesRes.data) setTables(tablesRes.data as DiningTable[]);
    if (menuRes.data) setMenu(menuRes.data as MenuItem[]);
    if (waitRes.data) setWaitlist(waitRes.data as WaitEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
    const ch = supabase
      .channel("intel-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, loadAll)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadAll]);

  // ---------- Incidents: persisted + realtime ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rest } = await supabase.from("restaurants").select("id").limit(1).maybeSingle();
      if (cancelled || !rest?.id) return;
      setRestaurantId(rest.id);
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("restaurant_id", rest.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled && data) setDbIncidents(data as IncidentRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`intel-incidents-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          setDbIncidents((prev) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id?: string })?.id;
              return oldId ? prev.filter((r) => r.id !== oldId) : prev;
            }
            const row = payload.new as IncidentRow;
            const rest = prev.filter((r) => r.id !== row.id);
            return [row, ...rest];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  // Upsert new AI-detected incidents (preserve existing status via ignoreDuplicates)
  useEffect(() => {
    if (!restaurantId || !ai?.incidents?.length) return;
    const existing = new Set(dbIncidents.map((r) => r.fingerprint));
    const fresh = ai.incidents
      .map((i) => ({
        restaurant_id: restaurantId,
        fingerprint: fingerprintIncident(i.title),
        title: i.title,
        priority: i.priority,
        root_cause: i.root_cause ?? "",
        business_impact: i.business_impact ?? "",
        action: i.action ?? "",
      }))
      .filter((r) => r.fingerprint && !existing.has(r.fingerprint));
    if (!fresh.length) return;
    void supabase.from("incidents").upsert(fresh, { onConflict: "restaurant_id,fingerprint", ignoreDuplicates: true });
  }, [ai, restaurantId, dbIncidents]);

  const updateIncidentStatus = useCallback(
    async (row: IncidentRow, status: "dismissed" | "resolved") => {
      setPendingIds((s) => new Set(s).add(row.id));
      const patch: Partial<IncidentRow> = {
        status,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      };
      // Optimistic
      setDbIncidents((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } as IncidentRow : r)));
      const { error } = await supabase.from("incidents").update(patch).eq("id", row.id);
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
      if (error) {
        toast.error(`Could not ${status === "resolved" ? "resolve" : "dismiss"} incident`);
        // Reload to revert
        const { data } = await supabase
          .from("incidents")
          .select("*")
          .eq("restaurant_id", row.restaurant_id)
          .order("created_at", { ascending: false })
          .limit(200);
        if (data) setDbIncidents(data as IncidentRow[]);
      } else {
        toast.success(status === "resolved" ? "Incident resolved" : "Incident dismissed");
      }
    },
    [],
  );


  // ---------- Derived live metrics ----------
  const metrics = useMemo(() => computeMetrics(orders, items, tables, menu, waitlist), [orders, items, tables, menu, waitlist]);
  const health = useMemo(() => computeHealth(metrics), [metrics]);
  const predictions = useMemo(() => computePredictions(orders, waitlist, metrics), [orders, waitlist, metrics]);
  const timeline = useMemo(() => buildTimeline(orders, tables, menu, waitlist), [orders, tables, menu, waitlist]);
  const tableLabelById = useMemo(() => new Map(tables.map((t) => [t.id, t.label])), [tables]);

  const filteredTimeline = useMemo(() => {
    let list = timeline;
    if (filter === "hour") {
      const cutoff = Date.now() - 3600 * 1000;
      list = list.filter((e) => new Date(e.ts).getTime() >= cutoff);
    } else if (filter === "table" && filterValue) {
      list = list.filter((e) => e.tableId === filterValue);
    } else if (filter === "order" && filterValue) {
      list = list.filter((e) => e.orderId?.startsWith(filterValue) ?? false);
    }
    return list.slice(0, 60);
  }, [timeline, filter, filterValue]);

  // ---------- AI insights (throttled, live-triggered) ----------
  const snapshotForAI = useMemo(() => buildAiSnapshot(metrics, predictions, health), [metrics, predictions, health]);
  const snapshotKey = JSON.stringify(snapshotForAI);

  const refreshInsights = useCallback(async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await runInsights({ data: { snapshot: snapshotForAI } });
      setAi(res);
      lastAiRef.current = Date.now();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI insights failed";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiBusy(false);
    }
  }, [runInsights, snapshotForAI]);

  useEffect(() => {
    if (loading) return;
    const since = Date.now() - lastAiRef.current;
    if (!ai || since > 60_000) void refreshInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey, loading]);

  const openIncidents = useMemo(() => dbIncidents.filter((r) => r.status === "open"), [dbIncidents]);
  const resolvedToday = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    return dbIncidents.filter((r) => r.status === "resolved" && r.resolved_at && new Date(r.resolved_at).getTime() >= cutoff);
  }, [dbIncidents]);

  if (loading) return <IntelSkeleton />;

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
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">Intelligence Center</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">Mission control · live analysis</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Realtime
            </Badge>
            <Button size="sm" variant="outline" onClick={() => void refreshInsights()} disabled={aiBusy}>
              <Wand2 className="mr-1.5 h-4 w-4" /> {aiBusy ? "Analyzing…" : "Refresh AI"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Row 1: Health + KPIs */}
        <section className="grid gap-6 lg:grid-cols-3">
          <HealthCard health={health} metrics={metrics} />
          <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<Activity className="h-4 w-4" />} label="Active orders" value={String(metrics.activeOrders)} sub={`${metrics.kitchenBacklog} in kitchen`} />
            <Kpi icon={<Utensils className="h-4 w-4" />} label="Revenue 24h" value={`$${metrics.revenue24h.toFixed(0)}`} sub={`${metrics.orders24h} tickets · $${metrics.avgTicket.toFixed(2)} avg`} />
            <Kpi icon={<Users className="h-4 w-4" />} label="Tables seated" value={`${metrics.seatedTables}/${metrics.totalTables}`} sub={`${Math.round(metrics.occupancy * 100)}% occupancy`} />
            <Kpi icon={<Clock className="h-4 w-4" />} label="Avg prep" value={`${metrics.avgPrepMinutes ?? "—"}${metrics.avgPrepMinutes !== null ? "m" : ""}`} sub={`${metrics.waiting} in queue · ${metrics.eightySixCount} 86'd`} />
          </div>
        </section>

        {/* Row 2: Charts */}
        <section className="grid gap-6 lg:grid-cols-3">
          <ChartCard title="Revenue trend · last 12h" icon={<LineChartIcon className="h-4 w-4" />} empty={metrics.hourly.every((h) => h.revenue === 0)}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={metrics.hourly}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="oklch(var(--primary))" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Orders per hour" icon={<Activity className="h-4 w-4" />} empty={metrics.hourly.every((h) => h.orders === 0)}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.hourly}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="orders" fill="oklch(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Kitchen load · active tickets" icon={<ChefHat className="h-4 w-4" />} empty={metrics.hourly.every((h) => h.kitchen === 0)}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics.hourly}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="kitchen" stroke="oklch(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Row 3: AI feed + Incidents + Recommendations */}
        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="AI ops feed" hint={aiBusy ? "Analyzing…" : `${ai?.feed.length ?? 0} events`} />
            {aiError && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{aiError}</div>}
            {!ai && !aiBusy && <EmptyLine>Waiting for first AI analysis.</EmptyLine>}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {(ai?.feed ?? []).map((e) => (
                <div key={e.id} className={`rounded-xl border p-3 ${severityBorder(e.severity)}`}>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Badge variant="outline" className={`${severityTone(e.severity)} text-[10px]`}>{e.severity}</Badge>
                    <span>{e.category}</span>
                    <span className="ml-auto">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="mt-1.5 text-sm font-medium">{e.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{e.detail}</div>
                  {e.recommendation && (
                    <div className="mt-2 rounded-md bg-primary/5 px-2 py-1.5 text-xs text-primary">→ {e.recommendation}</div>
                  )}
                </div>
              ))}
              {ai && ai.feed.length === 0 && <EmptyLine>Restaurant is calm — nothing to flag.</EmptyLine>}
            </div>
          </Card>

          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <SectionHeader
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Incident center"
              hint={`${openIncidents.length} open · ${resolvedToday.length} resolved 24h`}
            />
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {openIncidents.map((i) => {
                const pending = pendingIds.has(i.id);
                return (
                  <div key={i.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] uppercase ${priorityTone(i.priority)}`}>{i.priority}</Badge>
                      <div className="text-sm font-semibold">{i.title}</div>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs">
                      {i.root_cause && <div><span className="text-muted-foreground">Root cause · </span>{i.root_cause}</div>}
                      {i.business_impact && <div><span className="text-muted-foreground">Impact · </span>{i.business_impact}</div>}
                      {i.action && <div className="rounded-md bg-primary/5 px-2 py-1.5 text-primary">→ {i.action}</div>}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-muted-foreground">
                        Detected {new Date(i.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => void updateIncidentStatus(i, "dismissed")}>
                          Dismiss
                        </Button>
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => void updateIncidentStatus(i, "resolved")}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {openIncidents.length === 0 && <EmptyLine>No incidents detected. Ops running clean.</EmptyLine>}
              {resolvedToday.length > 0 && (
                <div className="pt-3 border-t border-white/5 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Resolved · last 24h</div>
                  {resolvedToday.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate pr-2">{r.title}</span>
                      <span className="shrink-0">
                        {r.resolved_at ? new Date(r.resolved_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>


          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <SectionHeader icon={<Zap className="h-4 w-4" />} title="Smart recommendations" hint={`${ai?.recommendations.length ?? 0} moves`} />
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {(ai?.recommendations ?? []).map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{r.effort}</Badge>
                    <div className="text-sm font-medium">{r.title}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.reason}</div>
                </div>
              ))}
              {ai && ai.recommendations.length === 0 && <EmptyLine>No proactive moves suggested right now.</EmptyLine>}
            </div>
          </Card>
        </section>

        {/* Row 4: Predictions + Top items + Table heatmap */}
        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Predictive analytics" hint={`${predictions.confidence}% confidence`} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Prediction label="Next hour revenue" value={`$${predictions.nextHourRevenue.toFixed(0)}`} hint={predictions.revenueDirection} />
              <Prediction label="Expected kitchen load" value={`${predictions.expectedKitchenLoad}`} hint="tickets in flight" />
              <Prediction label="Expected queue" value={`${predictions.expectedQueue}`} hint="parties waiting" />
              <Prediction label="Likely busy period" value={predictions.busyWindow} hint="based on 24h" />
              <Prediction label="Inventory risk" value={predictions.inventoryRisk} hint={`${metrics.eightySixCount} items 86'd`} />
              <Prediction label="Confidence" value={`${predictions.confidence}%`} hint={predictions.sampleNote} />
            </div>
          </Card>

          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <SectionHeader icon={<Utensils className="h-4 w-4" />} title="Top selling · 24h" hint={`${metrics.topItems.length} tracked`} />
            {metrics.topItems.length === 0 ? (
              <EmptyLine>No items sold in the last 24 hours.</EmptyLine>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={metrics.topItems} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.6)" fontSize={11} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="qty" fill="oklch(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <SectionHeader icon={<Users className="h-4 w-4" />} title="Table occupancy" hint={`${metrics.seatedTables}/${metrics.totalTables} seated`} />
            <div className="grid grid-cols-4 gap-2">
              {tables.map((t) => {
                const idleMin = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 60000);
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-2 text-center ${tableHeatTone(t.status, idleMin)}`}
                    title={`${t.label} · ${t.status} · ${idleMin}m`}
                  >
                    <div className="text-xs font-semibold">{t.label}</div>
                    <div className="text-[10px] opacity-80">{t.status}</div>
                    <div className="mt-1 text-[10px] opacity-70">{idleMin}m</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <MiniStat label="Avg prep" value={metrics.avgPrepMinutes !== null ? `${metrics.avgPrepMinutes}m` : "—"} />
              <MiniStat label="Reservations 24h" value={String(waitlist.length)} />
            </div>
          </Card>
        </section>

        {/* Row 5: Replay timeline */}
        <section>
          <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionHeader icon={<History className="h-4 w-4" />} title="Restaurant replay" hint={`${filteredTimeline.length} events`} noMargin />
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                {(["today", "hour", "table", "order"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setFilterValue("");
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${filter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {f === "hour" ? "Last hour" : f}
                  </button>
                ))}
                {filter === "table" && (
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="rounded-md border border-white/10 bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Choose…</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                )}
                {filter === "order" && (
                  <input
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="Order id prefix"
                    className="w-32 rounded-md border border-white/10 bg-background px-2 py-1 text-xs"
                  />
                )}
              </div>
            </div>
            {filteredTimeline.length === 0 ? (
              <EmptyLine>No events for this filter.</EmptyLine>
            ) : (
              <ol className="relative border-l border-white/10 pl-6">
                {filteredTimeline.map((e, idx) => (
                  <li key={idx} className="mb-4 last:mb-0">
                    <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-background ${timelineDot(e.kind)}`} />
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase">{e.kind}</Badge>
                      <span className="text-sm font-medium">{e.label}</span>
                      {e.tableId && tableLabelById.get(e.tableId) && (
                        <span className="text-[11px] text-muted-foreground">· {tableLabelById.get(e.tableId)}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{e.detail}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}

// ============================================================
// Metric computation
// ============================================================

type Metrics = ReturnType<typeof computeMetrics>;

function computeMetrics(orders: Order[], items: OrderItem[], tables: DiningTable[], menu: MenuItem[], waitlist: WaitEntry[]) {
  const now = Date.now();
  const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const closed24 = orders.filter((o) => o.status === "closed");
  const revenue24h = orders.reduce((s, o) => s + o.total_cents, 0) / 100;
  const orders24h = orders.length;
  const avgTicket = orders24h ? revenue24h / orders24h : 0;
  const kitchenBacklog = items.filter((i) => i.status === "pending" || i.status === "preparing").length;
  const seatedTables = tables.filter((t) => t.status === "seated").length;
  const totalTables = tables.length;
  const occupancy = totalTables ? seatedTables / totalTables : 0;
  const menuAvailable = menu.filter((m) => m.is_available).length;
  const eightySixCount = menu.length - menuAvailable;
  const waiting = waitlist.filter((w) => w.status === "waiting" || w.status === "notified").length;

  // hourly buckets over last 12 hours
  const hourly = Array.from({ length: 12 }).map((_, idx) => {
    const end = now - idx * 3600 * 1000;
    const start = end - 3600 * 1000;
    const oIn = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= start && t < end;
    });
    const kActive = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      // still active OR closed after end
      const stillOpen = ACTIVE_STATUSES.has(o.status) && t <= end;
      const closedAfter = o.status === "closed" && t <= end && new Date(o.updated_at).getTime() >= start;
      return stillOpen || closedAfter;
    }).length;
    return {
      label: new Date(end).toLocaleTimeString([], { hour: "2-digit" }),
      revenue: oIn.reduce((s, o) => s + o.total_cents, 0) / 100,
      orders: oIn.length,
      kitchen: kActive,
      ts: end,
    };
  }).reverse();

  // avg prep: closed order duration in minutes
  const preps = closed24
    .map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000)
    .filter((v) => v > 0 && v < 240);
  const avgPrepMinutes = preps.length ? Math.round(preps.reduce((s, v) => s + v, 0) / preps.length) : null;

  // top items
  const topMap = new Map<string, number>();
  items.forEach((i) => topMap.set(i.name_snapshot, (topMap.get(i.name_snapshot) ?? 0) + i.quantity));
  const topItems = [...topMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, qty]) => ({ name, qty }));

  // trend: compare last 3h vs previous 3h
  const last3 = hourly.slice(-3).reduce((s, h) => s + h.revenue, 0);
  const prev3 = hourly.slice(-6, -3).reduce((s, h) => s + h.revenue, 0);
  const trend: "improving" | "declining" | "stable" =
    last3 > prev3 * 1.15 ? "improving" : last3 < prev3 * 0.85 ? "declining" : "stable";

  return {
    activeOrders: active.length,
    kitchenBacklog,
    revenue24h,
    orders24h,
    closedOrders: closed24.length,
    avgTicket,
    seatedTables,
    totalTables,
    occupancy,
    menuAvailable,
    menuTotal: menu.length,
    eightySixCount,
    waiting,
    avgPrepMinutes,
    hourly,
    topItems,
    trend,
    last3,
    prev3,
  };
}

// ============================================================
// Health score
// ============================================================

type Health = {
  score: number;
  band: string;
  trend: Metrics["trend"];
  confidence: number;
  reasons: { text: string; delta: number }[];
};

function computeHealth(m: Metrics): Health {
  let score = 100;
  const reasons: { text: string; delta: number }[] = [];

  // Kitchen backlog
  if (m.kitchenBacklog > 12) {
    score -= 20;
    reasons.push({ text: `Kitchen backlog high (${m.kitchenBacklog} items)`, delta: -20 });
  } else if (m.kitchenBacklog > 6) {
    score -= 8;
    reasons.push({ text: `Kitchen backlog elevated (${m.kitchenBacklog})`, delta: -8 });
  } else {
    reasons.push({ text: "Kitchen backlog under control", delta: 0 });
  }

  // Waiting customers
  if (m.waiting > 6) {
    score -= 15;
    reasons.push({ text: `${m.waiting} parties waiting`, delta: -15 });
  } else if (m.waiting > 2) {
    score -= 5;
    reasons.push({ text: `Small waitlist (${m.waiting})`, delta: -5 });
  }

  // Occupancy sweet spot
  if (m.totalTables > 0) {
    if (m.occupancy > 0.95) {
      score -= 5;
      reasons.push({ text: "Floor at capacity", delta: -5 });
    } else if (m.occupancy < 0.2 && m.orders24h > 0) {
      score -= 6;
      reasons.push({ text: "Floor mostly empty", delta: -6 });
    } else if (m.occupancy >= 0.4 && m.occupancy <= 0.85) {
      reasons.push({ text: `Healthy occupancy (${Math.round(m.occupancy * 100)}%)`, delta: 0 });
    }
  }

  // Menu availability
  const availRatio = m.menuTotal ? m.menuAvailable / m.menuTotal : 1;
  if (availRatio < 0.6) {
    score -= 15;
    reasons.push({ text: `Menu thin (${m.eightySixCount} 86'd)`, delta: -15 });
  } else if (availRatio < 0.85) {
    score -= 6;
    reasons.push({ text: `${m.eightySixCount} items 86'd`, delta: -6 });
  } else {
    reasons.push({ text: "Menu fully stocked", delta: 0 });
  }

  // Avg prep vs sane baseline (15m)
  if (m.avgPrepMinutes !== null) {
    if (m.avgPrepMinutes > 30) {
      score -= 12;
      reasons.push({ text: `Slow tickets (avg ${m.avgPrepMinutes}m)`, delta: -12 });
    } else if (m.avgPrepMinutes > 20) {
      score -= 5;
      reasons.push({ text: `Tickets running long (${m.avgPrepMinutes}m)`, delta: -5 });
    } else {
      reasons.push({ text: `Ticket time healthy (${m.avgPrepMinutes}m)`, delta: 0 });
    }
  }

  // Revenue trend
  if (m.trend === "improving") {
    score += 4;
    reasons.push({ text: "Revenue trending up", delta: 4 });
  } else if (m.trend === "declining") {
    score -= 6;
    reasons.push({ text: "Revenue trending down", delta: -6 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const band =
    score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 55 ? "Watch" : score >= 35 ? "Strained" : "Critical";

  // confidence scales with sample size
  const sample = m.orders24h + m.waiting + m.kitchenBacklog;
  const confidence = Math.min(99, 40 + Math.round(sample * 3));

  return { score, band, trend: m.trend, confidence, reasons: reasons.slice(0, 5) };
}

// ============================================================
// Predictions
// ============================================================

function computePredictions(orders: Order[], waitlist: WaitEntry[], m: Metrics) {
  const nowHour = new Date().getHours();
  // avg revenue at this hour across last 24h (single sample) plus current trend
  const currentHourRev = m.hourly[m.hourly.length - 1]?.revenue ?? 0;
  const trendFactor = m.trend === "improving" ? 1.2 : m.trend === "declining" ? 0.8 : 1;
  const avgHourRev = m.hourly.reduce((s, h) => s + h.revenue, 0) / Math.max(1, m.hourly.length);
  const nextHourRevenue = Math.max(0, Math.round(((currentHourRev + avgHourRev) / 2) * trendFactor));

  const expectedKitchenLoad = Math.max(0, Math.round(m.activeOrders * (m.trend === "improving" ? 1.25 : 0.9)));
  const expectedQueue = Math.max(0, Math.round(m.waiting * (m.occupancy > 0.75 ? 1.3 : 0.8)));

  const busyHour = [...m.hourly].sort((a, b) => b.orders - a.orders)[0];
  const busyWindow = busyHour && busyHour.orders > 0
    ? new Date(busyHour.ts).toLocaleTimeString([], { hour: "2-digit" })
    : "Not yet clear";

  const inventoryRisk =
    m.eightySixCount === 0 ? "Low" : m.eightySixCount < 3 ? "Moderate" : "High";

  const revenueDirection = m.trend === "improving" ? "trending up" : m.trend === "declining" ? "trending down" : "flat";
  const confidence = Math.min(95, 30 + m.orders24h * 4 + (waitlist.length ? 5 : 0) + (nowHour >= 11 && nowHour <= 22 ? 5 : 0));
  const sampleNote = `${m.orders24h} orders sampled`;

  return { nextHourRevenue, expectedKitchenLoad, expectedQueue, busyWindow, inventoryRisk, confidence, revenueDirection, sampleNote };
}

// ============================================================
// Timeline
// ============================================================

function buildTimeline(orders: Order[], tables: DiningTable[], menu: MenuItem[], waitlist: WaitEntry[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  orders.forEach((o) => {
    const short = o.id.slice(0, 6);
    events.push({
      ts: o.created_at,
      kind: "order",
      label: `Order #${short} placed`,
      detail: `${o.guest_name ?? "Guest"} · $${(o.total_cents / 100).toFixed(2)}`,
      tableId: o.table_id,
      orderId: o.id,
    });
    if (o.status === "closed" && o.updated_at !== o.created_at) {
      events.push({
        ts: o.updated_at,
        kind: "close",
        label: `Order #${short} closed`,
        detail: `Paid · $${(o.total_cents / 100).toFixed(2)}`,
        tableId: o.table_id,
        orderId: o.id,
      });
    } else if (o.updated_at !== o.created_at) {
      events.push({
        ts: o.updated_at,
        kind: "kitchen",
        label: `Order #${short} → ${o.status}`,
        detail: `Ticket advanced by kitchen`,
        tableId: o.table_id,
        orderId: o.id,
      });
    }
  });

  tables.forEach((t) => {
    if (t.updated_at) {
      events.push({
        ts: t.updated_at,
        kind: "table",
        label: `${t.label} · ${t.status}`,
        detail: `${t.seats} seats`,
        tableId: t.id,
      });
    }
  });

  waitlist.forEach((w) => {
    events.push({
      ts: w.created_at,
      kind: "waitlist",
      label: `${w.guest_name} joined queue`,
      detail: `Party of ${w.party_size} · quoted ${w.quoted_minutes}m`,
      tableId: w.seated_table_id,
    });
    if (w.status === "seated" && w.updated_at !== w.created_at) {
      events.push({
        ts: w.updated_at,
        kind: "waitlist",
        label: `${w.guest_name} seated`,
        detail: `Party of ${w.party_size}`,
        tableId: w.seated_table_id,
      });
    }
  });

  menu.forEach((mi) => {
    if (!mi.is_available && mi.updated_at) {
      events.push({
        ts: mi.updated_at,
        kind: "menu",
        label: `86'd ${mi.name}`,
        detail: `Item removed from live menu`,
      });
    }
  });

  return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

// ============================================================
// AI snapshot
// ============================================================

function buildAiSnapshot(m: Metrics, p: ReturnType<typeof computePredictions>, h: Health) {
  return {
    health_score: h.score,
    health_band: h.band,
    trend: m.trend,
    active_orders: m.activeOrders,
    kitchen_backlog: m.kitchenBacklog,
    orders_24h: m.orders24h,
    revenue_24h: Math.round(m.revenue24h),
    avg_ticket: Math.round(m.avgTicket * 100) / 100,
    avg_prep_minutes: m.avgPrepMinutes,
    tables_seated: m.seatedTables,
    tables_total: m.totalTables,
    occupancy_pct: Math.round(m.occupancy * 100),
    menu_available: m.menuAvailable,
    menu_total: m.menuTotal,
    eighty_sixed: m.eightySixCount,
    waitlist_active: m.waiting,
    closed_orders: m.closedOrders,
    top_items: m.topItems,
    hourly_revenue: m.hourly.map((h) => Math.round(h.revenue)),
    predictions: {
      next_hour_revenue: p.nextHourRevenue,
      expected_kitchen_load: p.expectedKitchenLoad,
      expected_queue: p.expectedQueue,
      busy_window: p.busyWindow,
      inventory_risk: p.inventoryRisk,
    },
  };
}

// ============================================================
// Presentational bits
// ============================================================

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
} as const;

function IntelSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 space-y-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80" />)}
      </div>
    </div>
  );
}

function HealthCard({ health, metrics }: { health: Health; metrics: Metrics }) {
  const ringColor =
    health.score >= 90 ? "text-primary"
    : health.score >= 70 ? "text-accent"
    : health.score >= 50 ? "text-yellow-400"
    : "text-destructive";
  const trendIcon =
    health.trend === "improving" ? <TrendingUp className="h-3 w-3" />
    : health.trend === "declining" ? <TrendingDown className="h-3 w-3" />
    : <Activity className="h-3 w-3" />;
  return (
    <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Gauge className="h-4 w-4" /> Restaurant health
        </div>
        <Badge variant="outline" className="gap-1 text-[10px] capitalize">
          {trendIcon} {health.trend}
        </Badge>
      </div>
      <div className="flex items-baseline gap-3">
        <div className={`text-6xl font-bold tracking-tight ${ringColor}`}>{health.score}</div>
        <div className="text-sm text-muted-foreground">/ 100</div>
        <div className={`ml-auto text-sm font-medium ${ringColor}`}>{health.band}</div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full transition-all duration-700 ${
            health.score >= 90 ? "bg-primary" : health.score >= 70 ? "bg-accent" : health.score >= 50 ? "bg-yellow-400" : "bg-destructive"
          }`}
          style={{ width: `${health.score}%` }}
        />
      </div>
      <div className="mt-4 text-[11px] text-muted-foreground">
        Confidence {health.confidence}% · {metrics.orders24h} orders sampled
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {health.reasons.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${r.delta < 0 ? "bg-destructive" : r.delta > 0 ? "bg-primary" : "bg-muted-foreground/50"}`} />
            <span className="text-muted-foreground">{r.text}</span>
            {r.delta !== 0 && (
              <span className={`ml-auto text-[10px] ${r.delta < 0 ? "text-destructive" : "text-primary"}`}>
                {r.delta > 0 ? "+" : ""}{r.delta}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="border-white/10 bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function ChartCard({ title, icon, children, empty }: { title: string; icon: React.ReactNode; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-white/10 bg-card/70 p-6 backdrop-blur">
      <SectionHeader icon={icon} title={title} />
      {empty ? <EmptyLine>Not enough data yet.</EmptyLine> : children}
    </Card>
  );
}

function SectionHeader({ icon, title, hint, noMargin }: { icon: React.ReactNode; title: string; hint?: string; noMargin?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${noMargin ? "" : "mb-4"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Prediction({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function severityTone(s: IntelInsight["severity"]) {
  switch (s) {
    case "critical": return "border-destructive/40 text-destructive";
    case "warn": return "border-yellow-400/40 text-yellow-400";
    case "positive": return "border-primary/40 text-primary";
    default: return "border-white/20 text-muted-foreground";
  }
}
function severityBorder(s: IntelInsight["severity"]) {
  switch (s) {
    case "critical": return "border-destructive/30 bg-destructive/5";
    case "warn": return "border-yellow-400/20 bg-yellow-400/5";
    case "positive": return "border-primary/30 bg-primary/5";
    default: return "border-white/10 bg-white/[0.02]";
  }
}
function priorityTone(p: IntelIncident["priority"]) {
  switch (p) {
    case "high": return "bg-destructive/20 text-destructive border border-destructive/30";
    case "medium": return "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30";
    default: return "bg-white/10 text-muted-foreground border border-white/20";
  }
}
function tableHeatTone(status: string, idleMin: number) {
  if (status === "seated") {
    if (idleMin > 45) return "border-destructive/40 bg-destructive/10 text-destructive";
    if (idleMin > 25) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
    return "border-primary/30 bg-primary/10 text-primary";
  }
  if (status === "cleaning") return "border-accent/30 bg-accent/10 text-accent";
  if (status === "reserved") return "border-white/15 bg-white/[0.04] text-foreground";
  return "border-white/10 bg-white/[0.02] text-muted-foreground";
}
function timelineDot(kind: TimelineEvent["kind"]) {
  switch (kind) {
    case "order": return "bg-primary";
    case "close": return "bg-emerald-500";
    case "kitchen": return "bg-accent";
    case "table": return "bg-yellow-400";
    case "waitlist": return "bg-blue-400";
    case "menu": return "bg-destructive";
  }
}
