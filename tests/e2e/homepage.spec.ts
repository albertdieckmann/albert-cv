import { test, expect } from "@playwright/test";

test("forsiden loader korrekt", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Albert Dieckmann");
});

test("navigation indeholder de rigtige links", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav")).toBeVisible();
  await expect(page.locator("nav a[href='#om']")).toBeVisible();
  await expect(page.locator("nav a[href='#erfaring']")).toBeVisible();
  await expect(page.locator("nav a[href='#kompetencer']")).toBeVisible();
  await expect(page.locator("nav a[href='#kontakt']")).toBeVisible();
});

test("hero-sektion viser navn og CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Albert");
  await expect(page.locator("a.hero-cta")).toBeVisible();
});

test("sign-in siden loader", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/sign-in/);
});

test("contact API svarer ok", async ({ request }) => {
  const response = await request.post("/api/contact", {
    data: { name: "Test", email: "test@test.dk", message: "E2E test" },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.ok).toBe(true);
});
