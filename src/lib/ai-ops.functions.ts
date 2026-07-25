import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MessageSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

type Snapshot = {
  restaurant: string;
  tables: { label: string; status: string; seats: number }[];
  menu: { name: string; available: boolean; price: number; prep_minutes: number }[];
  activeOrders: {
    id: string;
    status: string;
    table: string | null;
    total: number;
    minutes_open: number;
    items: { name: string; qty: number; status: string }[];
  }[];
  todayStats: {
    orders_placed: number;
    revenue: number;
    avg_ticket: number;
    avg_prep_minutes: number | null;
  };
};

export const askOpsAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => MessageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const supabase = context.supabase;

    const [rest, tables, items, orders, orderItems] = await Promise.all([
      supabase.from("restaurants").select("name").limit(1).maybeSingle(),
      supabase.from("dining_tables").select("label,status,seats").order("label"),
      supabase.from("menu_items").select("name,is_available,price_cents,prep_minutes").order("name"),
      supabase
        .from("orders")
        .select("id,status,table_id,total_cents,created_at")
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
      supabase
        .from("order_items")
        .select("order_id,name_snapshot,quantity,status")
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    ]);

    const tableMap = new Map((tables.data ?? []).map((t) => [t.label, t]));
    const now = Date.now();
    const active = (orders.data ?? []).filter((o) =>
      ["placed", "preparing", "ready"].includes(o.status),
    );
    const activeIds = new Set(active.map((o) => o.id));

    const snapshot: Snapshot = {
      restaurant: rest.data?.name ?? "Demo Restaurant",
      tables: (tables.data ?? []).map((t) => ({ label: t.label, status: t.status, seats: t.seats })),
      menu: (items.data ?? []).map((i) => ({
        name: i.name,
        available: i.is_available,
        price: i.price_cents / 100,
        prep_minutes: i.prep_minutes,
      })),
      activeOrders: active.map((o) => ({
        id: o.id.slice(0, 6),
        status: o.status,
        table:
          (tables.data ?? []).find((t) => (t as unknown as { id: string }).id === o.table_id)?.label ?? null,
        total: o.total_cents / 100,
        minutes_open: Math.round((now - new Date(o.created_at).getTime()) / 60000),
        items: (orderItems.data ?? [])
          .filter((i) => i.order_id === o.id)
          .map((i) => ({ name: i.name_snapshot, qty: i.quantity, status: i.status })),
      })),
      todayStats: {
        orders_placed: orders.data?.length ?? 0,
        revenue: (orders.data ?? []).reduce((s, o) => s + o.total_cents, 0) / 100,
        avg_ticket:
          orders.data && orders.data.length > 0
            ? Math.round(orders.data.reduce((s, o) => s + o.total_cents, 0) / orders.data.length) / 100
            : 0,
        avg_prep_minutes: null,
      },
    };
    // Suppress unused warning for tableMap
    void tableMap;
    void activeIds;

    const systemPrompt = `You are the on-shift operations assistant for ${snapshot.restaurant}, a live restaurant. You have real-time context. Be concise (max 4 short sentences or a tight bullet list). Speak like an experienced GM: specific, decisive, numeric. Suggest concrete actions (86 an item, prioritize a ticket, reseat a table). Never invent data — if unknown, say so.

Current snapshot (JSON):
${JSON.stringify(snapshot)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable settings.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "No response.";
    return { reply, snapshot };
  });

export const generateShiftSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const supabase = context.supabase;
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();

    const [orders, items, tables] = await Promise.all([
      supabase.from("orders").select("id,status,total_cents,created_at,table_id").gte("created_at", since),
      supabase.from("order_items").select("order_id,name_snapshot,quantity").gte("created_at", since),
      supabase.from("dining_tables").select("id,label,status"),
    ]);

    const revenue = (orders.data ?? []).reduce((s, o) => s + o.total_cents, 0) / 100;
    const count = orders.data?.length ?? 0;
    const topMap = new Map<string, number>();
    (items.data ?? []).forEach((i) => topMap.set(i.name_snapshot, (topMap.get(i.name_snapshot) ?? 0) + i.quantity));
    const top = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const stillOpen = (orders.data ?? []).filter((o) => ["placed", "preparing", "ready"].includes(o.status)).length;
    const seated = (tables.data ?? []).filter((t) => t.status === "seated").length;

    const context_json = {
      window_hours: 12,
      orders: count,
      revenue,
      avg_ticket: count ? Math.round((revenue / count) * 100) / 100 : 0,
      still_open: stillOpen,
      seated_tables: seated,
      total_tables: tables.data?.length ?? 0,
      top_sellers: top.map(([name, qty]) => ({ name, qty })),
    };

    const prompt = `You are writing an end-of-shift brief for the incoming manager. Use the metrics below. Format as markdown with three short sections: "Numbers" (2-3 bullets), "Wins" (1-2 bullets), "Watch-outs / actions for next shift" (2-3 bullets). Be specific and numeric. Do not invent data.\n\nMetrics:\n${JSON.stringify(context_json, null, 2)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable settings.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { summary: json.choices?.[0]?.message?.content?.trim() ?? "No summary.", metrics: context_json };
  });

