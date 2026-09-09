import "server-only";
import { GoogleGenAI } from "@google/genai";

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

export async function generateGeminiText(prompt: string) {
  const client = getGeminiClient();
  if (!client) throw new Error("GEMINI_NOT_CONFIGURED");
  const response = await client.models.generateContent({ model: getGeminiModel(), contents: prompt });
  const text = response.text?.trim();
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return text;
}

export async function generateGeminiJson(prompt: string, responseJsonSchema: Record<string, unknown>) {
  const client = getGeminiClient();
  if (!client) throw new Error("GEMINI_NOT_CONFIGURED");
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
}
