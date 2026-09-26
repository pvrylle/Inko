import "server-only";
import { generateGeminiJson, generateGeminiText, isGeminiConfigured } from "./gemini";
import { generateOpenAIJson, generateOpenAIText, isOpenAIConfigured } from "./openai";

export type AiProvider = "auto" | "gemini" | "openai";

/**
 * Plan B text generation: Gemini and/or OpenAI (compatible).
 * - `AI_PROVIDER=auto` (default): try preferred order, fall over if one fails
 * - `AI_PROVIDER=gemini` | `openai`: force a single provider
 */
export function getAiProviderPreference(): AiProvider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (raw === "gemini" || raw === "openai" || raw === "auto") return raw;
  return "auto";
}

export function isAiConfigured() {
  return isGeminiConfigured() || isOpenAIConfigured();
}

function providerOrder(): Array<"gemini" | "openai"> {
  const preference = getAiProviderPreference();
  if (preference === "gemini") return ["gemini"];
  if (preference === "openai") return ["openai"];
  // Prefer Gemini when both are set; OpenAI is the spare tire.
  if (isGeminiConfigured() && isOpenAIConfigured()) return ["gemini", "openai"];
  if (isOpenAIConfigured()) return ["openai"];
  if (isGeminiConfigured()) return ["gemini"];
  return [];
}

async function withProviderFallback<T>(run: (provider: "gemini" | "openai") => Promise<T>): Promise<T> {
  const order = providerOrder();
  if (order.length === 0) throw new Error("AI_NOT_CONFIGURED");

  let lastError: unknown;
  for (const provider of order) {
    try {
      return await run(provider);
    } catch (error) {
      lastError = error;
      // Try the other Plan B key when auto mode has a spare.
      continue;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("AI_FAILED");
}

export async function generateText(prompt: string) {
  return withProviderFallback(async (provider) => {
    if (provider === "gemini") return generateGeminiText(prompt);
    return generateOpenAIText(prompt);
  });
}

export async function generateJson(prompt: string, responseJsonSchema: Record<string, unknown>) {
  return withProviderFallback(async (provider) => {
    if (provider === "gemini") return generateGeminiJson(prompt, responseJsonSchema);
    return generateOpenAIJson(prompt, responseJsonSchema);
  });
}
