const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

export type GatewayResult = {
  text: string;
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
};

/**
 * Single entry point for every Lovable AI Gateway chat call.
 * Handles auth, error mapping and usage accounting for the audit trail.
 */
export async function callGateway(
  messages: GatewayMessage[],
  opts: { model?: string; maxCompletionTokens?: number } = {},
): Promise<GatewayResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");

  const model = opts.model ?? "google/gemini-3.6-flash";
  const started = Date.now();

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      ...(opts.maxCompletionTokens ? { max_completion_tokens: opts.maxCompletionTokens } : {}),
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
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: json.choices?.[0]?.message?.content?.trim() ?? "",
    model,
    latencyMs: Date.now() - started,
    promptTokens: json.usage?.prompt_tokens ?? null,
    completionTokens: json.usage?.completion_tokens ?? null,
  };
}
