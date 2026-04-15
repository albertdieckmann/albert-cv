import { test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";

test("forsiden har ingen kritiske accessibility-fejl", async ({ page }) => {
  await page.goto("/");

  // Scroll igennem siden for at trigge IntersectionObserver-animationer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  await injectAxe(page);
  await checkA11y(page, undefined, {
    axeOptions: {
      runOnly: ["wcag2a", "wcag2aa"],
    },
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});
