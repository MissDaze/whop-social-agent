const OR_MODEL = "meta-llama/llama-3.1-8b-instruct:free";
const FALLBACK_KEY = "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";

export async function callOpenRouter(
  apiKey: string | null | undefined,
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<string> {
  const key = apiKey || FALLBACK_KEY;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://whop-social-agent.app",
      "X-Title": "Whop Social Agent",
    },
    body: JSON.stringify({ model: OR_MODEL, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
