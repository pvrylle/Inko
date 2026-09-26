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
  return /429|403|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate.?limit|overloaded/i.test(message);
}

async function withGeminiFallback<T>(run: (client: GoogleGenAI) => Promise<T>): Promise<T> {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error("GEMINI_NOT_CONFIGURED");

  let lastError: unknown;
  for (let index = 0; index < keys.length; index += 1) {
    const client = new GoogleGenAI({ apiKey: keys[index] });
    try {
      return await run(client);
    } catch (error) {
      lastError = error;
      const hasNext = index < keys.length - 1;
      if (!hasNext || !isRetryableGeminiError(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GEMINI_FAILED");
}

export async function generateGeminiText(prompt: string) {
  return withGeminiFallback(async (client) => {
    const response = await client.models.generateContent({ model: getGeminiModel(), contents: prompt });
    const text = response.text?.trim();
    if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
    return text;
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
