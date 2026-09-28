import { expect, test } from "@playwright/test";

test("a companion conversation resumes and can be renamed or deleted", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("inko.hasCompletedOnboarding", "1"));
  await page.route("**/api/chat", (route) => route.fulfill({ json: { text: "Let's make a biology plan.", sources: [] } }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "New conversation", level: 1 })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("textbox", { name: "Message Inko" }).fill("Help me plan biology");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Let's make a biology plan.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Help me plan biology", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Let's make a biology plan.")).toBeVisible();
  if (await page.getByRole("button", { name: "Show conversations" }).isVisible()) {
    await page.getByRole("button", { name: "Show conversations" }).click();
  }

  await page.getByRole("button", { name: "Options for Help me plan biology" }).click();
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "Conversation title" }).fill("Biology prep");
  await page.getByRole("button", { name: "Save title" }).click();
  await expect(page.getByRole("heading", { name: "Biology prep", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "New conversation" }).first().click();
  await expect(page.getByRole("heading", { name: "New conversation", level: 1 })).toBeVisible();
  if (await page.getByRole("button", { name: "Show conversations" }).isVisible()) {
    await page.getByRole("button", { name: "Show conversations" }).click();
  }
  await page.getByRole("button", { name: "Biology prep", exact: true }).click();
  await expect(page.getByText("Let's make a biology plan.")).toBeVisible();

  if (await page.getByRole("button", { name: "Show conversations" }).isVisible()) {
    await page.getByRole("button", { name: "Show conversations" }).click();
  }

  await page.getByRole("button", { name: "Options for Biology prep" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(page.getByText("Delete this conversation?")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New conversation", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Biology prep", exact: true })).toHaveCount(0);
});

test("conversation options stay inside a long scrollable list", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "Session 0", level: 1 })).toBeVisible({ timeout: 15_000 });
  if (await page.getByRole("button", { name: "Show conversations" }).isVisible()) {
    await page.getByRole("button", { name: "Show conversations" }).click();
  }
  const options = page.getByRole("button", { name: "Options for Session 24" });
  await options.scrollIntoViewIfNeeded();
  await options.click();

  const list = await page.locator(".home-conversations-list").boundingBox();
  const rename = await page.getByRole("button", { name: "Rename" }).boundingBox();
  const remove = await page.getByRole("button", { name: "Delete", exact: true }).boundingBox();
  expect(list && rename && remove).toBeTruthy();
  expect(rename!.y).toBeGreaterThanOrEqual(list!.y);
  expect(remove!.y + remove!.height).toBeLessThanOrEqual(list!.y + list!.height);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Rename" })).toHaveCount(0);
  await expect(options).toBeFocused();
  await options.click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
});
