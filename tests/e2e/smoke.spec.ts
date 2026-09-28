import { expect, test } from "@playwright/test";

test("shows the companion conversation workspace", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("inko.hasCompletedOnboarding", "1"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /New conversation/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Message Inko/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start talking to Inko/i })).toBeVisible();
});
