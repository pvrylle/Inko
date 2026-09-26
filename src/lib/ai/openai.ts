import "server-only";

/** OpenAI Chat Completions — also works with compatible hosts via OPENAI_BASE_URL. */

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  return { apiKey, baseUrl, model: getOpenAIModel() };
}

async function chatCompletion(messages: { role: "system" | "user"; content: string }[], jsonMode: boolean) {
  const config = getOpenAIConfig();
  if (!config) throw new Error("OPENAI_NOT_CONFIGURED");

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: jsonMode ? 0.25 : 0.7,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OPENAI_REQUEST_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return text;
}

export async function generateOpenAIText(prompt: string) {
  return chatCompletion([{ role: "user", content: prompt }], false);
}

export async function generateOpenAIJson(prompt: string, _responseJsonSchema: Record<string, unknown>) {
  // Schema is enforced by the caller (Zod). Ask the model for JSON explicitly.
  const text = await chatCompletion(
    [
      {
        role: "system",
        content: "Reply with a single JSON object only. No markdown fences or commentary.",
      },
      { role: "user", content: prompt },
    ],
    true,
  );
  return JSON.parse(text) as unknown;
}
