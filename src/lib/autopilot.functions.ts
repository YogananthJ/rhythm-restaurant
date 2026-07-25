import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SnapshotSchema = z.object({
  snapshot: z.record(z.string(), z.unknown()),
});

export type ActionKind =
  | "eighty_six_item"
  | "unhide_item"
  | "seat_waitlist"
  | "mark_table_cleaning"
  | "prioritize_ticket"
  | "notify_guest"
  | "advisory";

export type AutopilotAction = {
  id: string;
  title: string;
  problem: string;
  root_cause: string;
  business_impact: string;
  recommended_action: string;
  confidence: number; // 0-100
  estimated_improvement: string;
  severity: "info" | "warn" | "critical";
  signals: string[];
  action: {
    kind: ActionKind;
    /** Menu item name (for eighty_six_item / unhide_item) */
    item_name?: string;
    /** Table label (for mark_table_cleaning / seat_waitlist) */
    table_label?: string;
    /** Waitlist guest name (for seat_waitlist / notify_guest) */
    guest_name?: string;
    /** Short order id prefix (for prioritize_ticket) */
    order_prefix?: string;
  };
};

export type RiskPrediction = {
  id: string;
  title: string;
  probability: number; // 0-100
  eta_minutes: number;
  intervention: string;
  signals: string[];
};

export type AutopilotResponse = {
  actions: AutopilotAction[];
  risks: RiskPrediction[];
  narrative: string;
};

export const generateAutopilotPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SnapshotSchema.parse(d))
  .handler(async ({ data }): Promise<AutopilotResponse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const system = `You are the AUTOPILOT for a live restaurant — think Tesla Autopilot for operations. You continuously watch a JSON snapshot of the floor and must PROACTIVELY propose operational moves BEFORE problems escalate. You never chat; you only emit structured JSON.

Rules:
- Base every action on numbers actually in the snapshot. Never invent items, tables, guests, or numbers.
- Prefer specific, executable actions tied to real entities present in the snapshot (menu item names, table labels, waitlist guest names, order id prefixes).
- Confidence reflects strength of the underlying signal (0-100). Estimated improvement must be quantitative (minutes saved, % waste reduced, $ revenue gained, guests seated).
- Severity: critical = act now, warn = act within 10 min, info = worth noting.
- Signals list the 2-4 raw metrics you used (e.g. "kitchen_backlog=7", "waitlist_length=4", "avg_prep=14m").
- Emit 0-6 actions and 0-4 risks. If the floor is calm, return short arrays plus a one-line narrative.
- Narrative: one sentence describing the overall state of the restaurant, grounded in the snapshot.

Action kinds you may propose (map to action.kind):
- eighty_six_item: hide a specific menu item (requires item_name that exists in snapshot.menu)
- unhide_item: re-enable a currently unavailable item (requires item_name)
- seat_waitlist: seat a waitlist guest at a free table (requires guest_name from snapshot.waitlist; optional table_label from snapshot.tables where status is free/cleaning)
- mark_table_cleaning: flip a table to cleaning (requires table_label)
- prioritize_ticket: flag an order that's been open too long (requires order_prefix)
- notify_guest: text a waitlist guest their table is ready (requires guest_name)
- advisory: pure advisory, no button-level execution

Output ONLY JSON matching this schema exactly:
{
  "actions": [{"title","problem","root_cause","business_impact","recommended_action","confidence","estimated_improvement","severity","signals":[...],"action":{"kind","item_name?","table_label?","guest_name?","order_prefix?"}}],
  "risks": [{"title","probability","eta_minutes","intervention","signals":[...]}],
  "narrative": "string"
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Live snapshot:\n${JSON.stringify(data.snapshot)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable settings.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "{}";
    let parsed: Partial<AutopilotResponse> = {};
    try {
      parsed = JSON.parse(raw) as Partial<AutopilotResponse>;
    } catch {
      parsed = {};
    }

    const stamp = Date.now();
    const actions: AutopilotAction[] = (parsed.actions ?? []).slice(0, 6).map((a, i) => ({
      id: `act-${stamp}-${i}`,
      title: String(a.title ?? "Action"),
      problem: String(a.problem ?? ""),
      root_cause: String(a.root_cause ?? ""),
      business_impact: String(a.business_impact ?? ""),
      recommended_action: String(a.recommended_action ?? ""),
      confidence: clamp(Number(a.confidence ?? 60), 0, 100),
      estimated_improvement: String(a.estimated_improvement ?? ""),
      severity: (["info", "warn", "critical"].includes(String(a.severity)) ? a.severity : "warn") as AutopilotAction["severity"],
      signals: Array.isArray(a.signals) ? a.signals.slice(0, 6).map(String) : [],
      action: {
        kind: (["eighty_six_item", "unhide_item", "seat_waitlist", "mark_table_cleaning", "prioritize_ticket", "notify_guest", "advisory"].includes(
          String(a.action?.kind),
        )
          ? a.action?.kind
          : "advisory") as ActionKind,
        item_name: a.action?.item_name ? String(a.action.item_name) : undefined,
        table_label: a.action?.table_label ? String(a.action.table_label) : undefined,
        guest_name: a.action?.guest_name ? String(a.action.guest_name) : undefined,
        order_prefix: a.action?.order_prefix ? String(a.action.order_prefix) : undefined,
      },
    }));

    const risks: RiskPrediction[] = (parsed.risks ?? []).slice(0, 4).map((r, i) => ({
      id: `risk-${stamp}-${i}`,
      title: String(r.title ?? "Risk"),
      probability: clamp(Number(r.probability ?? 50), 0, 100),
      eta_minutes: clamp(Number(r.eta_minutes ?? 15), 1, 240),
      intervention: String(r.intervention ?? ""),
      signals: Array.isArray(r.signals) ? r.signals.slice(0, 6).map(String) : [],
    }));

    return {
      actions,
      risks,
      narrative: String(parsed.narrative ?? "Restaurant is operating normally."),
    };
  });

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
