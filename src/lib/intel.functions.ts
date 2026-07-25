import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SnapshotSchema = z.object({
  snapshot: z.record(z.string(), z.unknown()),
});

export type IntelInsight = {
  id: string;
  severity: "info" | "warn" | "critical" | "positive";
  category: string;
  title: string;
  detail: string;
  recommendation: string;
};

export type IntelIncident = {
  id: string;
  priority: "low" | "medium" | "high";
  title: string;
  root_cause: string;
  business_impact: string;
  action: string;
};

export type IntelRecommendation = {
  id: string;
  title: string;
  reason: string;
  effort: "quick" | "medium" | "planning";
};

export type IntelResponse = {
  feed: IntelInsight[];
  incidents: IntelIncident[];
  recommendations: IntelRecommendation[];
};

export const generateIntelInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SnapshotSchema.parse(d))
  .handler(async ({ data }): Promise<IntelResponse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const system = `You are the on-shift operations analyst for a live restaurant. You will be given a real-time JSON snapshot of the restaurant. Return a compact JSON object with three arrays: feed, incidents, recommendations.

Rules:
- Base every item on the numbers in the snapshot. If a number is 0 or absent, do not fabricate an event about it.
- Every item must be short (<= 22 words), specific, and numeric where possible.
- Feed items describe what is HAPPENING right now (positive or negative). Severity: info | warn | critical | positive.
- Incidents describe operational problems that need action. Priority: low | medium | high. Include root_cause, business_impact, action.
- Recommendations are proactive moves the manager could make in the next 15 minutes. Effort: quick | medium | planning.
- Never invent staff names, table numbers, or menu items that aren't in the snapshot.
- If the restaurant is idle, return short arrays (1-2 items) reflecting that calm state.
- Output ONLY the JSON object. No prose.`;

    const schemaHint = `{
  "feed": [{"severity":"info|warn|critical|positive","category":"string","title":"string","detail":"string","recommendation":"string"}],
  "incidents": [{"priority":"low|medium|high","title":"string","root_cause":"string","business_impact":"string","action":"string"}],
  "recommendations": [{"title":"string","reason":"string","effort":"quick|medium|planning"}]
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Snapshot:\n${JSON.stringify(data.snapshot)}\n\nReturn JSON matching:\n${schemaHint}`,
          },
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
    let parsed: Partial<IntelResponse> = {};
    try {
      parsed = JSON.parse(raw) as Partial<IntelResponse>;
    } catch {
      parsed = {};
    }
    const withIds = <T extends object>(arr: T[] | undefined, prefix: string): (T & { id: string })[] =>
      (arr ?? []).slice(0, 8).map((x, i) => ({ ...x, id: `${prefix}-${Date.now()}-${i}` }));

    return {
      feed: withIds(parsed.feed, "f") as IntelInsight[],
      incidents: withIds(parsed.incidents, "i") as IntelIncident[],
      recommendations: withIds(parsed.recommendations, "r") as IntelRecommendation[],
    };
  });
