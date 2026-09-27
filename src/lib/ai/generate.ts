import "server-only";
import { generateFastGeminiText, generateGeminiJson, generateGeminiText, isGeminiConfigured } from "./gemini";

/** Gemini is the only reasoning model. AssemblyAI carries live audio and does not answer on its own. */
export function isAiConfigured() {
  return isGeminiConfigured();
}

export async function generateText(prompt: string) {
  return generateGeminiText(prompt);
}

export async function generateFastText(prompt: string) {
  return generateFastGeminiText(prompt);
}

export async function generateJson(prompt: string, responseJsonSchema: Record<string, unknown>) {
  return generateGeminiJson(prompt, responseJsonSchema);
}
