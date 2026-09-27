import "server-only";
import { GoogleGenAI } from "@google/genai";

function geminiKeys() {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key));
}

export function isGeminiConfigured() {
  return geminiKeys().length > 0;
}

export function getGeminiClient() {
  const [primary] = geminiKeys();
  return primary ? new GoogleGenAI({ apiKey: primary }) : null;
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|overloaded/i.test(message);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withGeminiFallback<T>(run: (client: GoogleGenAI) => Promise<T>): Promise<T> {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error("GEMINI_NOT_CONFIGURED");

  let sawRetryable = false;
  for (const apiKey of keys) {
    const client = new GoogleGenAI({ apiKey });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await run(client);
      } catch (error) {
        if (!isRetryableGeminiError(error)) throw new Error("GEMINI_FAILED");
        sawRetryable = true;
        if (attempt < 2) await wait(700 * (attempt + 1));
      }
    }
  }
  throw new Error(sawRetryable ? "GEMINI_UNAVAILABLE" : "GEMINI_FAILED");
}

export async function generateGeminiText(prompt: string) {
  return withGeminiFallback(async (client) => {
    const response = await client.models.generateContent({ model: getGeminiModel(), contents: prompt });
    const text = response.text?.trim();
    if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
    return text;
  });
}

type GeminiChatPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export async function generateGeminiChat(input: {
  system: string;
  contents: Array<{ role: "user" | "model"; parts: GeminiChatPart[] }>;
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
}) {
  return withGeminiFallback(async (client) => {
    const response = await client.models.generateContent({
      model: getGeminiModel(),
      contents: input.contents,
      config: {
        systemInstruction: input.system || undefined,
        temperature: 0.4,
        ...(input.tools.length > 0 ? { tools: [{ functionDeclarations: input.tools }] } : {}),
      },
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((part) => part.text ?? "").join("").trim();
    const calls = parts.flatMap((part) => {
      const call = part.functionCall;
      if (!call?.name) return [];
      const args = call.args && typeof call.args === "object" ? call.args as Record<string, unknown> : {};
      return [{ name: call.name, args }];
    });
    if (!text && calls.length === 0) throw new Error("GEMINI_EMPTY_RESPONSE");
    return { text, calls, model: getGeminiModel() };
  });
}

export async function generateGeminiJson(prompt: string, responseJsonSchema: Record<string, unknown>) {
  return withGeminiFallback(async (client) => {
    const response = await client.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema,
        temperature: 0.25,
      },
    });
    const text = response.text?.trim();
    if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
    return JSON.parse(text) as unknown;
  });
}
