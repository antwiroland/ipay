import { expect, test } from "@playwright/test";

test("mobile navigation and product grid work on a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Shop iPhones" }).click();
  await expect(page).toHaveURL(/\/shop/);
  // No horizontal overflow on the page body.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
