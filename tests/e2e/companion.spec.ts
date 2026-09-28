import { expect, test, type Page } from "@playwright/test";

async function showHistory(page: Page) {
  const openAssistant = page.getByRole("button", { name: "Open assistant" });
  if (await openAssistant.isVisible() && await page.locator(".assistant-rail").getAttribute("data-open") !== "true") await openAssistant.click();
  const panel = page.getByRole("region", { name: "Inko assistant" });
  await panel.getByRole("button", { name: "Show conversations" }).click();
  return panel;
}

test("a conversation resumes and can be renamed or deleted", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("inko.hasCompletedOnboarding", "1"));
  await page.route("**/api/chat", (route) => route.fulfill({ json: { text: "Let's make a biology plan.", sources: [] } }));

  await page.goto("/");
  await page.locator("main").getByRole("textbox", { name: "Message Inko" }).fill("Help me plan biology");
  await page.locator("main").getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("main").getByText("Let's make a biology plan.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator("main").getByText("Let's make a biology plan.", { exact: true })).toBeVisible();
  let panel = await showHistory(page);
  await panel.locator('summary[aria-label="Options for Help me plan biology"]').click();
  await panel.getByRole("button", { name: "Rename" }).click();
  await panel.getByRole("textbox", { name: "Conversation title" }).fill("Biology prep");
  await panel.getByRole("button", { name: "Save title" }).click();
  await expect(panel.getByRole("button", { name: "Biology prep", exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "New conversation" }).click();
  await expect(page.locator("main").getByRole("heading", { name: "What should we work on?" })).toBeVisible();
  panel = await showHistory(page);
  await panel.getByRole("button", { name: "Biology prep", exact: true }).click();
  await expect(page.locator("main").getByText("Let's make a biology plan.", { exact: true })).toBeVisible();

  panel = await showHistory(page);
  await panel.locator('summary[aria-label="Options for Biology prep"]').click();
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(panel.getByText("Delete this conversation?")).toBeVisible();
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator("main").getByRole("heading", { name: "What should we work on?" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Biology prep", exact: true })).toHaveCount(0);
});

test("conversation options stay usable in a long list", async ({ page }) => {
  await page.addInitScript(() => {
    const ownerId = "00000000-0000-4000-8000-000000000001";
    window.localStorage.setItem("inko.hasCompletedOnboarding", "1");
    window.localStorage.setItem("inko.demo-user-id", ownerId);
    window.localStorage.setItem(`inko.companion.sessions.${ownerId}`, JSON.stringify(
      Array.from({ length: 25 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`,
        owner_id: ownerId,
        title: `Session ${index}`,
        messages: [],
        research_session_id: null,
        created_at: new Date(Date.UTC(2026, 8, 28, 10, 0, -index)).toISOString(),
        updated_at: new Date(Date.UTC(2026, 8, 28, 10, 0, -index)).toISOString(),
      })),
    ));
  });

  await page.goto("/");
  const panel = await showHistory(page);
  const options = panel.locator('summary[aria-label="Options for Session 24"]');
  await options.scrollIntoViewIfNeeded();
  await options.click();
  const menu = panel.locator(".assistant-history-options[open] > div");
  await expect(menu.getByRole("button", { name: "Rename" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Delete" })).toBeVisible();
  const listBox = await panel.locator(".assistant-history").boundingBox();
  const menuBox = await menu.boundingBox();
  expect(listBox && menuBox).toBeTruthy();
  expect(menuBox!.y).toBeGreaterThanOrEqual(listBox!.y);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(listBox!.y + listBox!.height);
});
