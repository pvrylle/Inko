import { expect, test } from "@playwright/test";

test("shows the companion conversation workspace", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("inko.hasCompletedOnboarding", "1"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /What should we work on/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Message Inko/i })).toBeVisible();
  await expect(page.locator("main").getByRole("button", { name: /Start talking to Inko/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Attach PDF or image/i })).toBeVisible();
});

test("a new project has its own chat and workspace", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("inko.hasCompletedOnboarding", "1"));
  await page.goto("/projects?new=1");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Voice research");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Project workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What should we work on?" })).toBeVisible();
  await page.getByRole("button", { name: "White paper" }).click();
  await expect(page.getByRole("textbox", { name: "White paper draft" })).toBeVisible();
  await page.getByRole("textbox", { name: "White paper draft" }).fill("# First draft");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(page.getByText("Drop PDFs or images here")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "White paper" }).click();
  await expect(page.getByRole("textbox", { name: "White paper draft" })).toHaveValue("# First draft");
});

test("project chat saves an attached image and its conversation", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("inko.hasCompletedOnboarding", "1"));
  await page.route("**/api/chat/attachment", (route) => route.fulfill({ json: { text: "The image shows a simple blue square." } }));
  await page.goto("/projects?new=1");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Image notes");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await page.locator("main input[type=file]").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLtyAAAAABJRU5ErkJggg==", "base64"),
  });
  await page.getByRole("textbox", { name: "Message Inko" }).fill("Explain this image");
  await page.locator("main").getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("main").getByText("The image shows a simple blue square.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(page.getByText("sample.png")).toBeVisible();
  await page.reload();
  await expect(page.locator("main").getByText("The image shows a simple blue square.", { exact: true })).toBeVisible();
});

test("interim speech appears live before it becomes a chat turn", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("inko.hasCompletedOnboarding", "1");
    class Recognition {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((event: { resultIndex: number; results: { 0: { transcript: string }; isFinal: boolean; length: number }[] }) => void) | null = null;
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      constructor() {
        (window as typeof window & { __emitTranscript?: (text: string) => void }).__emitTranscript = (text) => {
          this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: text }, isFinal: false, length: 1 }] });
        };
      }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: Recognition, configurable: true });
  });
  await page.route("**/api/chat", (route) => route.fulfill({ json: { text: "Let's explore that topic.", sources: [] } }));
  await page.goto("/");
  await page.locator("main").getByRole("button", { name: "Start talking to Inko" }).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { __emitTranscript?: (text: string) => void }).__emitTranscript))).toBe(true);
  await page.evaluate(() => (window as typeof window & { __emitTranscript?: (text: string) => void }).__emitTranscript?.("r"));
  await expect(page.locator("main .home-live-transcript")).toContainText("r");
  await expect(page.locator(".assistant-live > p")).toHaveText("r");
  await page.evaluate(() => (window as typeof window & { __emitTranscript?: (text: string) => void }).__emitTranscript?.("research methods"));
  await expect(page.locator("main").getByText("Let's explore that topic.", { exact: true })).toBeVisible();
});
