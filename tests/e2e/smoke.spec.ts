import { expect, test } from "@playwright/test";

test("shows the voice-first home experience", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hey Inko/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start talking to Inko/i })).toBeVisible();
});
