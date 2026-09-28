import "server-only";
import { GoogleGenAI } from "@google/genai";

function geminiKeys() {
  return [...new Set([process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key)))];
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

/** Home and spoken replies. Study work keeps GEMINI_MODEL. */
export function getGeminiChatModel() {
  return process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-flash-lite-latest";
}

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|overloaded/i.test(message);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isMissingModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /404|no longer available|NOT_FOUND/i.test(message);
}

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
        if (isMissingModelError(error)) throw new Error("GEMINI_MODEL_UNAVAILABLE");
        if (!isRetryableGeminiError(error)) throw new Error("GEMINI_FAILED");
        sawRetryable = true;
        if (attempt < 2) await wait(700 * (attempt + 1));
      }
    }
  }
  throw new Error(sawRetryable ? "GEMINI_UNAVAILABLE" : "GEMINI_FAILED");
}

async function generateGeminiTextWithModel(prompt: string, model: string, maxOutputTokens?: number) {
  return withGeminiFallback(async (client) => {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: maxOutputTokens ? { maxOutputTokens, temperature: 0.7 } : undefined,
    });
    const text = response.text?.trim();
    if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
    return text;
  });
}

export async function generateGeminiText(prompt: string) {
  return generateGeminiTextWithModel(prompt, getGeminiModel());
}

/** Home and voice replies. Falls back to the study model if the fast model is retired. */
export async function generateFastGeminiText(prompt: string) {
  let text = "";
  for await (const piece of generateFastGeminiTextStream(prompt)) text += piece;
  const trimmed = text.trim();
  if (!trimmed) throw new Error("GEMINI_EMPTY_RESPONSE");
  return trimmed;
}

async function* streamModel(client: GoogleGenAI, model: string, prompt: string) {
  const stream = await client.models.generateContentStream({
    model,
    contents: prompt,
    config: { maxOutputTokens: 48, temperature: 0.4 },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

/** A short study answer. Uses the fast chat model, then the study model if that id is retired. */
export async function generateStudyAnswer(prompt: string) {
  const models = [getGeminiChatModel(), getGeminiModel()].filter((model, index, all) => all.indexOf(model) === index);
  let lastError: unknown;
  for (const model of models) {
    try {
      return await withGeminiFallback(async (client) => {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: { maxOutputTokens: 360, temperature: 0.3 },
        });
        const text = response.text?.trim();
        if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
        return text;
      });
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== "GEMINI_MODEL_UNAVAILABLE") throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GEMINI_FAILED");
}

/** Yields reply text as Gemini writes it, so the home page can leave "Thinking…" early. */
export async function* generateFastGeminiTextStream(prompt: string) {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error("GEMINI_NOT_CONFIGURED");
  const models = [getGeminiChatModel(), getGeminiModel()].filter((model, index, all) => all.indexOf(model) === index);
  let sawRetryable = false;
  for (const model of models) {
    for (const apiKey of keys) {
      let emitted = false;
      try {
        for await (const piece of streamModel(new GoogleGenAI({ apiKey }), model, prompt)) {
          emitted = true;
          yield piece;
        }
        return;
      } catch (error) {
        // Retrying after text is visible would duplicate the beginning of the reply.
        if (emitted) throw new Error("GEMINI_UNAVAILABLE");
        if (isMissingModelError(error)) break;
        if (!isRetryableGeminiError(error)) throw new Error("GEMINI_FAILED");
        sawRetryable = true;
      }
    }
  }
  throw new Error(sawRetryable ? "GEMINI_UNAVAILABLE" : "GEMINI_MODEL_UNAVAILABLE");
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
  const models = [getGeminiModel(), getGeminiChatModel()].filter((model, index, all) => all.indexOf(model) === index);
  let lastError: unknown;
  for (const model of models) {
    try {
      return await withGeminiFallback(async (client) => {
        const response = await client.models.generateContent({
          model,
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
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      if (message !== "GEMINI_UNAVAILABLE" && message !== "GEMINI_MODEL_UNAVAILABLE") throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GEMINI_FAILED");
}
