import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  COPILOT_SYSTEM_PROMPT,
  MAX_PROMPT_CHARS,
  contextBlock,
  guardInput,
  guardOutput,
} from "@/lib/ai-guardrails";
import { recordAiAudit } from "@/lib/ai-audit";

const MessageSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});

export const askOpsAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => MessageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const guard = guardInput(lastUser?.content ?? "");

    const [rest, tables, items, orders, orderItems, reservations, waitlist] = await Promise.all([
      supabase.from("restaurants").select("id,name,currency,tax_pct,service_pct").limit(1).maybeSingle(),
      supabase.from("dining_tables").select("id,label,status,seats").order("label"),
      supabase
        .from("menu_items")
        .select("name,is_available,price_cents,prep_minutes,dietary_tags")
        .order("name"),
      supabase
        .from("orders")
        .select("id,status,table_id,total_cents,created_at")
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
      supabase
        .from("order_items")
        .select("order_id,name_snapshot,quantity,status")
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
      supabase
        .from("reservations")
        .select("party_size,requested_at,status")
        .gte("requested_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
        .order("requested_at")
        .limit(20),
      supabase.from("waitlist").select("party_size,quoted_minutes,status,created_at").eq("status", "waiting"),
    ]);

    const restaurantId = rest.data?.id ?? null;

    if (!guard.ok) {
      await recordAiAudit(supabase, {
        restaurantId,
        userId: context.userId,
        feature: "copilot",
        prompt: lastUser?.content ?? "",
        context: { guard: guard.reason },
        response: guard.message,
        outcome: "blocked",
        blockReason: guard.reason,
      });
      return { reply: guard.message, blocked: true as const, reason: guard.reason };
    }

    const now = Date.now();
    const tableById = new Map((tables.data ?? []).map((t) => [t.id, t]));
    const active = (orders.data ?? []).filter((o) => ["placed", "preparing", "ready"].includes(o.status));
    const settled = (orders.data ?? []).filter((o) => ["paid", "closed"].includes(o.status));
    const revenue = settled.reduce((s, o) => s + o.total_cents, 0) / 100;

    const snapshot = {
      restaurant: rest.data?.name ?? "Demo Restaurant",
      currency: rest.data?.currency ?? "USD",
      generated_at: new Date().toISOString(),
      occupancy: {
        seated: (tables.data ?? []).filter((t) => t.status === "seated").length,
        total_tables: tables.data?.length ?? 0,
        tables: (tables.data ?? []).map((t) => ({ label: t.label, status: t.status, seats: t.seats })),
      },
      kitchen: {
        open_tickets: active.length,
        oldest_ticket_minutes: active.length
          ? Math.max(...active.map((o) => Math.round((now - new Date(o.created_at).getTime()) / 60000)))
          : 0,
        items_in_progress: (orderItems.data ?? []).filter((i) => i.status !== "served").length,
      },
      menu: (items.data ?? []).map((i) => ({
        name: i.name,
        available: i.is_available,
        price: i.price_cents / 100,
        prep_minutes: i.prep_minutes,
        dietary_tags: i.dietary_tags ?? [],
      })),
      active_orders: active.map((o) => ({
        ref: o.id.slice(0, 6),
        status: o.status,
        table: o.table_id ? (tableById.get(o.table_id)?.label ?? null) : null,
        total: o.total_cents / 100,
        minutes_open: Math.round((now - new Date(o.created_at).getTime()) / 60000),
        items: (orderItems.data ?? [])
          .filter((i) => i.order_id === o.id)
          .map((i) => ({ name: i.name_snapshot, qty: i.quantity, status: i.status })),
      })),
      reservations_next: (reservations.data ?? []).map((r) => ({
        party_size: r.party_size,
        at: r.requested_at,
        status: r.status,
      })),
      waitlist: (waitlist.data ?? []).map((w) => ({
        party_size: w.party_size,
        quoted_minutes: w.quoted_minutes,
        waiting_minutes: Math.round((now - new Date(w.created_at).getTime()) / 60000),
      })),
      last_24h: {
        orders_placed: orders.data?.length ?? 0,
        settled_orders: settled.length,
        settled_revenue: Math.round(revenue * 100) / 100,
        avg_ticket: settled.length ? Math.round((revenue / settled.length) * 100) / 100 : 0,
      },
    };

    const systemPrompt = `${COPILOT_SYSTEM_PROMPT}

You currently have live operational data for ${snapshot.restaurant}. Use it, cite exact numbers from it, and keep answers under ~6 bullets. Anything not present in the context below is unavailable — say so instead of guessing.

${contextBlock("live restaurant state", snapshot)}`;

    const trimmed = data.messages.map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_PROMPT_CHARS),
    }));

    try {
      const { callGateway } = await import("@/lib/ai-call.server");
      const result = await callGateway(
        [{ role: "system", content: systemPrompt }, ...trimmed],
        { maxCompletionTokens: 800 },
      );
      const reply = guardOutput(result.text) || "No response.";

      await recordAiAudit(supabase, {
        restaurantId,
        userId: context.userId,
        feature: "copilot",
        prompt: guard.prompt,
        context: snapshot,
        response: reply,
        outcome: "answered",
        model: result.model,
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });

      return { reply, snapshot, blocked: false as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI request failed";
      await recordAiAudit(supabase, {
        restaurantId,
        userId: context.userId,
        feature: "copilot",
        prompt: guard.prompt,
        context: snapshot,
        response: message,
        outcome: "error",
      });
      throw err;
    }
  });

export const generateShiftSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();

    const [rest, orders, items, tables] = await Promise.all([
      supabase.from("restaurants").select("id,name").limit(1).maybeSingle(),
      supabase.from("orders").select("id,status,total_cents,created_at,table_id").gte("created_at", since),
      supabase.from("order_items").select("order_id,name_snapshot,quantity").gte("created_at", since),
      supabase.from("dining_tables").select("id,label,status"),
    ]);

    const settled = (orders.data ?? []).filter((o) => ["paid", "closed"].includes(o.status));
    const revenue = settled.reduce((s, o) => s + o.total_cents, 0) / 100;
    const count = settled.length;
    const topMap = new Map<string, number>();
    (items.data ?? []).forEach((i) => topMap.set(i.name_snapshot, (topMap.get(i.name_snapshot) ?? 0) + i.quantity));
    const top = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const stillOpen = (orders.data ?? []).filter((o) => ["placed", "preparing", "ready"].includes(o.status)).length;
    const seated = (tables.data ?? []).filter((t) => t.status === "seated").length;

    const metrics = {
      window_hours: 12,
      settled_orders: count,
      settled_revenue: Math.round(revenue * 100) / 100,
      avg_ticket: count ? Math.round((revenue / count) * 100) / 100 : 0,
      still_open: stillOpen,
      seated_tables: seated,
      total_tables: tables.data?.length ?? 0,
      top_sellers: top.map(([name, qty]) => ({ name, qty })),
    };

    const { callGateway } = await import("@/lib/ai-call.server");
    const result = await callGateway(
      [
        { role: "system", content: COPILOT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write an end-of-shift brief for the incoming manager. Markdown with three short sections: "Numbers" (2-3 bullets), "Wins" (1-2 bullets), "Watch-outs / actions for next shift" (2-3 bullets). Be specific and numeric. Only use the metrics below.\n\n${contextBlock("shift metrics", metrics)}`,
        },
      ],
      { maxCompletionTokens: 700 },
    );

    const summary = guardOutput(result.text) || "No summary.";

    await recordAiAudit(supabase, {
      restaurantId: rest.data?.id ?? null,
      userId: context.userId,
      feature: "shift_summary",
      prompt: "12-hour shift handoff summary",
      context: metrics,
      response: summary,
      outcome: "answered",
      model: result.model,
      latencyMs: result.latencyMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });

    return { summary, metrics };
  });
