import { generateFastGeminiText } from "./gemini";

vi.mock("server-only", () => ({}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(private readonly options: { apiKey: string }) {}

    models = {
      generateContentStream: async () => {
        if (this.options.apiKey !== "third-key") throw new Error("429 RESOURCE_EXHAUSTED");
        return (async function* () { yield { text: "Third key worked." }; })();
      },
    };
  },
}));

it("uses the third Gemini key after the first two exhaust their quota", async () => {
  vi.stubEnv("GEMINI_API_KEY", "first-key");
  vi.stubEnv("GEMINI_API_KEY2", "second-key");
  vi.stubEnv("GEMINI_API_KEY3", "third-key");
  try {
    expect(await generateFastGeminiText("Hello")).toBe("Third key worked.");
  } finally {
    vi.unstubAllEnvs();
  }
});
