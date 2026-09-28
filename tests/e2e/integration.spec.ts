import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("inko.hasCompletedOnboarding", "1"));
});

const pages = [
  ["/", /What should we work on/i],
  ["/research", /Start a research project/i],
  ["/sources", /Sources/i],
  ["/canvas", /Canvas/i],
  ["/practice", /Practice/i],
  ["/history", /History/i],
  ["/settings", /Settings/i],
] as const;

test("all study surfaces render and expose a current route", async ({ page }) => {
  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible({ timeout: 15_000 });
    if (["/research", "/history"].includes(path) || (page.viewportSize()?.width ?? 0) >= 1100 && ["/sources", "/settings"].includes(path)) {
      const currentLinks = page.locator('a[aria-current="page"]:visible');
      await expect(currentLinks.first()).toBeVisible();
    }
  }
});

test("the mobile layout has no horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const [path] of pages) {
    await page.goto(path);
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows, `${path} overflowed at 320px`).toBe(false);
  }
});

test("a demo focus timer survives reload", async ({ page }) => {
  await page.goto("/focus");
  const startResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/study/focus/start");
  await page.getByRole("button", { name: /Start focus/i }).click();
  expect((await startResponse).ok()).toBe(true);
  await expect(page.getByRole("button", { name: /Pause/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /Pause/i })).toBeVisible();

  const stopResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/study/focus/control");
  await page.getByRole("button", { name: /End session/i }).click();
  expect((await stopResponse).ok()).toBe(true);
  await expect(page.getByRole("button", { name: /Start focus/i })).toBeVisible();
});

test("responses include baseline security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toContain("microphone=(self)");
});
