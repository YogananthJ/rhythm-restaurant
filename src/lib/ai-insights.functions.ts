import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COPILOT_SYSTEM_PROMPT, contextBlock, guardOutput } from "@/lib/ai-guardrails";
import { recordAiAudit } from "@/lib/ai-audit";

const REVENUE_STATUSES = new Set(["paid", "closed"]);

const RangeSchema = z.object({ days: z.number().int().min(1).max(90).default(14) });

/**
 * Revenue insights: hour-of-day and day-of-week trends plus AI narration of
 * the biggest drivers. Every number handed to the model comes from the DB.
 */
export const getRevenueInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const [rest, orders, items] = await Promise.all([
      supabase.from("restaurants").select("id,name").limit(1).maybeSingle(),
      supabase.from("orders").select("id,status,total_cents,created_at").gte("created_at", since),
      supabase
        .from("order_items")
        .select("order_id,name_snapshot,quantity,unit_price_cents,created_at")
        .gte("created_at", since),
    ]);

    const settled = (orders.data ?? []).filter((o) => REVENUE_STATUSES.has(o.status));
    const settledIds = new Set(settled.map((o) => o.id));

    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0 }));
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byWeekday = dayNames.map((d) => ({ day: d, revenue: 0, orders: 0 }));
    const byDate = new Map<string, { date: string; revenue: number; orders: number }>();

    for (const o of settled) {
      const d = new Date(o.created_at);
      const money = o.total_cents / 100;
      byHour[d.getHours()].revenue += money;
      byHour[d.getHours()].orders += 1;
      byWeekday[d.getDay()].revenue += money;
      byWeekday[d.getDay()].orders += 1;
      const key = d.toISOString().slice(0, 10);
      const row = byDate.get(key) ?? { date: key, revenue: 0, orders: 0 };
      row.revenue += money;
      row.orders += 1;
      byDate.set(key, row);
    }

    const round = <T extends { revenue: number }>(rows: T[]) =>
      rows.map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }));

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const i of items.data ?? []) {
      if (!settledIds.has(i.order_id)) continue;
      const row = productMap.get(i.name_snapshot) ?? { name: i.name_snapshot, qty: 0, revenue: 0 };
      row.qty += i.quantity;
      row.revenue += (i.unit_price_cents * i.quantity) / 100;
      productMap.set(i.name_snapshot, row);
    }
    const topProducts = round([...productMap.values()].sort((a, b) => b.revenue - a.revenue)).slice(0, 8);

    const dailySeries = round([...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)));
    const revenue = Math.round(settled.reduce((s, o) => s + o.total_cents, 0)) / 100;
    const half = Math.floor(dailySeries.length / 2);
    const firstHalf = dailySeries.slice(0, half).reduce((s, r) => s + r.revenue, 0);
    const secondHalf = dailySeries.slice(half).reduce((s, r) => s + r.revenue, 0);
    const trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 1000) / 10 : null;

    const metrics = {
      window_days: data.days,
      settled_orders: settled.length,
      open_or_cancelled_orders: (orders.data?.length ?? 0) - settled.length,
      revenue,
      avg_ticket: settled.length ? Math.round((revenue / settled.length) * 100) / 100 : 0,
      trend_pct_second_half_vs_first: trendPct,
      by_hour: round(byHour).filter((h) => h.orders > 0),
      by_weekday: round(byWeekday),
      daily: dailySeries,
      top_products: topProducts,
    };

    let narrative = "";
    let outcome: "answered" | "error" = "answered";
    let model: string | null = null;
    let latencyMs: number | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    if (settled.length === 0) {
      narrative =
        "No settled tickets in this window, so there is nothing to explain yet. Close a few orders in Billing and the driver analysis will populate.";
    } else {
      try {
        const { callGateway } = await import("@/lib/ai-call.server");
        const result = await callGateway(
          [
            { role: "system", content: COPILOT_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Explain this restaurant's revenue performance to its manager. Write markdown with three sections: "What happened" (2-3 bullets), "Biggest drivers" (2-3 bullets naming the exact hours, days or dishes and their figures), "Do next" (2 bullets, concrete). Only use the numbers below; never invent figures.\n\n${contextBlock("revenue metrics", metrics)}`,
            },
          ],
          { maxCompletionTokens: 700 },
        );
        narrative = guardOutput(result.text) || "No explanation returned.";
        model = result.model;
        latencyMs = result.latencyMs;
        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
      } catch (err) {
        outcome = "error";
        narrative = err instanceof Error ? err.message : "AI explanation unavailable.";
      }
    }

    await recordAiAudit(supabase, {
      restaurantId: rest.data?.id ?? null,
      userId: context.userId,
      feature: "revenue_insights",
      prompt: `Revenue insight over ${data.days} days`,
      context: metrics,
      response: narrative,
      outcome,
      model,
      latencyMs,
      promptTokens,
      completionTokens,
    });

    return { metrics, narrative, restaurant: rest.data?.name ?? "Your restaurant" };
  });

/**
 * Menu recommendations from predicted demand (recent velocity + popularity),
 * live availability (the only inventory signal this system stores) and
 * kitchen-to-table constraints (prep minutes vs current ticket load).
 */
export const getMenuRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
    const since2 = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

    const [rest, menu, recentItems, liveItems, openOrders, tables] = await Promise.all([
      supabase.from("restaurants").select("id,name").limit(1).maybeSingle(),
      supabase
        .from("menu_items")
        .select("id,name,price_cents,prep_minutes,is_available,popularity_score,promo_boost,dietary_tags")
        .order("name"),
      supabase.from("order_items").select("menu_item_id,quantity,created_at").gte("created_at", since14),
      supabase.from("order_items").select("menu_item_id,quantity,status").gte("created_at", since2),
      supabase.from("orders").select("id,status").in("status", ["placed", "preparing", "ready"]),
      supabase.from("dining_tables").select("id,status"),
    ]);

    const nowHour = new Date().getHours();
    const demand = new Map<string, { total: number; sameHour: number; last2h: number }>();
    for (const i of recentItems.data ?? []) {
      if (!i.menu_item_id) continue;
      const row = demand.get(i.menu_item_id) ?? { total: 0, sameHour: 0, last2h: 0 };
      row.total += i.quantity;
      const h = new Date(i.created_at).getHours();
      if (Math.abs(h - nowHour) <= 1) row.sameHour += i.quantity;
      demand.set(i.menu_item_id, row);
    }
    for (const i of liveItems.data ?? []) {
      if (!i.menu_item_id) continue;
      const row = demand.get(i.menu_item_id) ?? { total: 0, sameHour: 0, last2h: 0 };
      row.last2h += i.quantity;
      demand.set(i.menu_item_id, row);
    }

    const openTickets = openOrders.data?.length ?? 0;
    const seated = (tables.data ?? []).filter((t) => t.status === "seated").length;
    const totalTables = tables.data?.length ?? 0;
    // Kitchen load factor: more open tickets => longer effective prep.
    const loadFactor = 1 + Math.min(openTickets, 12) * 0.08;

    const candidates = (menu.data ?? []).map((m) => {
      const d = demand.get(m.id) ?? { total: 0, sameHour: 0, last2h: 0 };
      const predicted = Math.round((d.sameHour / 14 + d.last2h * 0.5) * 100) / 100;
      const effectivePrep = Math.round(m.prep_minutes * loadFactor);
      const marginProxy = m.price_cents / 100 / Math.max(effectivePrep, 1);
      const score =
        predicted * 2 +
        Number(m.popularity_score ?? 0) +
        Number(m.promo_boost ?? 0) +
        marginProxy * 0.6 -
        (effectivePrep > 20 ? 1.5 : 0) -
        (m.is_available ? 0 : 99);
      return {
        id: m.id,
        name: m.name,
        price: m.price_cents / 100,
        available: m.is_available,
        prep_minutes: m.prep_minutes,
        effective_prep_minutes: effectivePrep,
        predicted_next_hour: predicted,
        sold_14d: d.total,
        dietary_tags: m.dietary_tags ?? [],
        score: Math.round(score * 100) / 100,
      };
    });

    const promote = candidates
      .filter((c) => c.available)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const throttle = candidates
      .filter((c) => c.available && c.effective_prep_minutes > 20 && c.predicted_next_hour < 0.5)
      .sort((a, b) => b.effective_prep_minutes - a.effective_prep_minutes)
      .slice(0, 4);
    const restock = candidates
      .filter((c) => !c.available)
      .sort((a, b) => b.sold_14d - a.sold_14d)
      .slice(0, 4);

    const payload = {
      kitchen: {
        open_tickets: openTickets,
        seated_tables: seated,
        total_tables: totalTables,
        load_factor: Math.round(loadFactor * 100) / 100,
        hour_of_day: nowHour,
      },
      inventory_signal: "availability flag only — Occupancy does not track ingredient-level stock",
      promote,
      throttle,
      restock,
    };

    let narrative = "";
    let outcome: "answered" | "error" = "answered";
    let model: string | null = null;
    let latencyMs: number | null = null;

    try {
      const { callGateway } = await import("@/lib/ai-call.server");
      const result = await callGateway(
        [
          { role: "system", content: COPILOT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Advise the kitchen and floor on what to push right now. Markdown, three short sections: "Push now", "Hold back", "Bring back / 86 review". One line per dish, each with its reason (predicted demand, prep minutes under current load, or availability). Only use the data below.\n\n${contextBlock("menu recommendation inputs", payload)}`,
          },
        ],
        { maxCompletionTokens: 600 },
      );
      narrative = guardOutput(result.text);
      model = result.model;
      latencyMs = result.latencyMs;
    } catch (err) {
      outcome = "error";
      narrative = err instanceof Error ? err.message : "AI narration unavailable.";
    }

    await recordAiAudit(supabase, {
      restaurantId: rest.data?.id ?? null,
      userId: context.userId,
      feature: "menu_recommendations",
      prompt: "Menu recommendations from predicted demand, availability and kitchen load",
      context: payload,
      response: narrative,
      outcome,
      model,
      latencyMs,
    });

    return { ...payload, narrative, restaurant: rest.data?.name ?? "Your restaurant" };
  });

const AuditQuery = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  feature: z.string().max(40).optional(),
});

export const listAiAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AuditQuery.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ai_audit_log")
      .select("id,feature,prompt,response,outcome,block_reason,model,latency_ms,prompt_tokens,completion_tokens,context,created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.feature) q = q.eq("feature", data.feature);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
