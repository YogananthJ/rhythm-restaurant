import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMenuRecommendations, getRevenueInsights, listAiAudit } from "@/lib/ai-insights.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  ChefHat,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Revenue & Menu Insights — Occupancy" },
      {
        name: "description",
        content:
          "AI-explained revenue trends by hour and day, demand-aware menu recommendations, and a full AI audit trail.",
      },
      { property: "og:title", content: "Revenue & Menu Insights — Occupancy" },
      {
        property: "og:description",
        content: "Understand what drove today's revenue and what the kitchen should push next.",
      },
    ],
  }),
  component: InsightsPage,
});

type RevenueData = Awaited<ReturnType<typeof getRevenueInsights>>;
type MenuData = Awaited<ReturnType<typeof getMenuRecommendations>>;
type AuditRow = Awaited<ReturnType<typeof listAiAudit>>["rows"][number];

const money = (n: number) => `$${n.toFixed(2)}`;

function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (/^#{1,6}\s/.test(t) || /^\*\*.+\*\*:?$/.test(t))
          return (
            <p key={i} className="pt-2 text-sm font-semibold text-foreground">
              {t.replace(/^#{1,6}\s/, "").replace(/\*\*/g, "").replace(/:$/, "")}
            </p>
          );
        if (/^[-*•]\s/.test(t))
          return (
            <p key={i} className="pl-4 -indent-3">
              <span className="text-primary">•</span> {t.replace(/^[-*•]\s/, "").replace(/\*\*/g, "")}
            </p>
          );
        return <p key={i}>{t.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; revenue: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex min-w-0 items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">{r.label}</span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${(r.revenue / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-foreground/80">
            {money(r.revenue)}
          </span>
        </div>
      ))}
    </div>
  );
}

function InsightsPage() {
  const revenueFn = useServerFn(getRevenueInsights);
  const menuFn = useServerFn(getMenuRecommendations);
  const auditFn = useServerFn(listAiAudit);

  const [days, setDays] = useState(14);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loadingRev, setLoadingRev] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [openAudit, setOpenAudit] = useState<string | null>(null);

  const loadRevenue = useCallback(
    async (d: number) => {
      setLoadingRev(true);
      try {
        setRevenue(await revenueFn({ data: { days: d } }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load revenue insights");
      } finally {
        setLoadingRev(false);
      }
    },
    [revenueFn],
  );

  const loadMenu = useCallback(async () => {
    setLoadingMenu(true);
    try {
      setMenu(await menuFn({ data: undefined }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load menu recommendations");
    } finally {
      setLoadingMenu(false);
    }
  }, [menuFn]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await auditFn({ data: { limit: 25 } });
      setAudit(res.rows as AuditRow[]);
    } catch {
      /* audit is non-critical */
    }
  }, [auditFn]);

  useEffect(() => {
    void loadRevenue(days);
  }, [loadRevenue, days]);
  useEffect(() => {
    void loadMenu();
    void loadAudit();
  }, [loadMenu, loadAudit]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="min-w-0 truncate text-base font-semibold">Revenue & Menu Insights</h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {[7, 14, 30].map((d) => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void loadRevenue(days);
                void loadMenu();
                void loadAudit();
              }}
              aria-label="Refresh insights"
            >
              <RefreshCw className={`h-4 w-4 ${loadingRev || loadingMenu ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        {/* Revenue insights */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="min-w-0 p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Revenue trend · last {days} days</h2>
              {revenue?.metrics.trend_pct_second_half_vs_first != null && (
                <Badge variant={revenue.metrics.trend_pct_second_half_vs_first >= 0 ? "default" : "destructive"}>
                  {revenue.metrics.trend_pct_second_half_vs_first >= 0 ? "+" : ""}
                  {revenue.metrics.trend_pct_second_half_vs_first}% vs first half
                </Badge>
              )}
            </div>

            {revenue ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">By hour</p>
                  {revenue.metrics.by_hour.length ? (
                    <Bars rows={revenue.metrics.by_hour.map((h) => ({ label: `${h.hour}:00`, revenue: h.revenue }))} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No settled tickets yet.</p>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">By day of week</p>
                  <Bars rows={revenue.metrics.by_weekday.map((d) => ({ label: d.day, revenue: d.revenue }))} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading revenue…</p>
            )}

            {revenue && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Settled revenue", money(revenue.metrics.revenue)],
                  ["Settled tickets", String(revenue.metrics.settled_orders)],
                  ["Avg ticket", money(revenue.metrics.avg_ticket)],
                  ["Top dish", revenue.metrics.top_products[0]?.name ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0 rounded-lg border border-border/60 p-3">
                    <p className="truncate text-xs text-muted-foreground">{k}</p>
                    <p className="truncate text-sm font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="min-w-0 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">What drove it</h2>
            </div>
            {revenue ? <Markdown text={revenue.narrative} /> : <p className="text-sm text-muted-foreground">Analysing…</p>}
          </Card>
        </section>

        {/* Menu recommendations */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="min-w-0 p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ChefHat className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Intelligent menu recommendations</h2>
              {menu && (
                <Badge variant="outline">
                  {menu.kitchen.open_tickets} open · load ×{menu.kitchen.load_factor}
                </Badge>
              )}
            </div>
            {menu ? (
              <div className="grid gap-5 md:grid-cols-3">
                {(
                  [
                    ["Push now", menu.promote, "text-primary"],
                    ["Hold back", menu.throttle, "text-amber-400"],
                    ["Unavailable", menu.restock, "text-destructive"],
                  ] as const
                ).map(([title, list, tone]) => (
                  <div key={title} className="min-w-0 space-y-2">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</p>
                    {list.length === 0 && <p className="text-xs text-muted-foreground">Nothing flagged.</p>}
                    {list.map((c) => (
                      <div key={c.id} className="min-w-0 rounded-lg border border-border/60 p-2.5">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {money(c.price)} · {c.effective_prep_minutes}m under load · demand{" "}
                          {c.predicted_next_hour}/hr · {c.sold_14d} sold 14d
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Scoring the menu…</p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Inventory signal is the live availability flag — Occupancy does not track ingredient-level stock.
            </p>
          </Card>

          <Card className="min-w-0 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Kitchen guidance</h2>
            </div>
            {menu ? <Markdown text={menu.narrative} /> : <p className="text-sm text-muted-foreground">Thinking…</p>}
          </Card>
        </section>

        {/* Audit log */}
        <Card className="min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">AI audit log</h2>
            <Badge variant="outline">{audit.length} recent calls</Badge>
            <span className="text-xs text-muted-foreground">
              Prompts, retrieved context and outcomes — secrets and guest contact details are redacted before storage.
            </span>
          </div>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI activity recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {audit.map((r) => (
                <div key={r.id} className="min-w-0 rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        r.outcome === "answered" ? "default" : r.outcome === "blocked" ? "destructive" : "outline"
                      }
                    >
                      {r.outcome}
                      {r.block_reason ? ` · ${r.block_reason}` : ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.feature}</span>
                    <span className="text-xs text-muted-foreground">{r.model ?? "—"}</span>
                    {r.latency_ms != null && <span className="text-xs text-muted-foreground">{r.latency_ms}ms</span>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 break-words text-sm">{r.prompt}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-xs"
                    onClick={() => setOpenAudit(openAudit === r.id ? null : r.id)}
                  >
                    <ClipboardList className="mr-1 h-3.5 w-3.5" />
                    {openAudit === r.id ? "Hide" : "Inspect"} context & answer
                  </Button>
                  {openAudit === r.id && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Answer</p>
                        <p className="whitespace-pre-wrap break-words text-sm">{r.response ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Retrieved context</p>
                        <pre className="max-h-64 overflow-auto rounded bg-muted/30 p-2 text-[11px] leading-snug">
                          {JSON.stringify(r.context, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
