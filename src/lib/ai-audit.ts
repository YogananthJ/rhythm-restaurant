import { redactSecrets } from "@/lib/ai-guardrails";

type MinimalClient = {
  from: (table: string) => {
    insert: (rows: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

export type AuditEntry = {
  restaurantId: string | null;
  userId: string | null;
  feature: "copilot" | "revenue_insights" | "menu_recommendations" | "shift_summary";
  prompt: string;
  context: unknown;
  response?: string | null;
  outcome: "answered" | "blocked" | "error";
  blockReason?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

/**
 * Best-effort append to the per-restaurant AI audit trail.
 * Never throws — a logging failure must not break the AI response.
 */
export async function recordAiAudit(client: unknown, entry: AuditEntry): Promise<void> {
  if (!entry.restaurantId) return;
  try {
    const supabase = client as MinimalClient;
    const { error } = await supabase.from("ai_audit_log").insert({
      restaurant_id: entry.restaurantId,
      user_id: entry.userId,
      feature: entry.feature,
      prompt: redactSecrets(entry.prompt).slice(0, 4000),
      context: JSON.parse(redactSecrets(JSON.stringify(entry.context ?? {}))),
      response: entry.response ? redactSecrets(entry.response).slice(0, 8000) : null,
      outcome: entry.outcome,
      block_reason: entry.blockReason ?? null,
      model: entry.model ?? null,
      latency_ms: entry.latencyMs ?? null,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
    });
    if (error) console.error("[ai-audit] insert failed:", error.message);
  } catch (err) {
    console.error("[ai-audit] unexpected failure:", err);
  }
}
