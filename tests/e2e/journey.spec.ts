import { expect, test, type Page } from "@playwright/test";

const uid = Date.now().toString().slice(-7);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("storefront shows database products and promotions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Own your next iPhone");
  await expect(page.getByText("Popular iPhones on installments")).toBeVisible();
  await page.getByRole("link", { name: "Shop iPhones" }).first().click();
  await expect(page).toHaveURL(/\/shop/);
  await expect(page.getByText(/iPhones? found/)).toBeVisible();
});

test("protected routes require authentication and the right role", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);

  await login(page, "kwame@example.com", "Customer123!");
  await expect(page).toHaveURL(/\/account/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account/); // customers bounced from admin
});

test("full customer journey: register → apply → pay deposit → pay off → balance GH₵0.00", async ({ page }) => {
  // Logged-out apply → login prompt that returns to the product.
  await page.goto("/products/iphone-13-128gb-uk-used");
  await expect(page.getByRole("link", { name: /Log in to apply/ })).toBeVisible();

  await page.goto("/register?next=/products/iphone-13-128gb-uk-used%23plans");
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(`e2e${uid}@example.com`);
  await page.getByLabel("Phone number").fill(`0249${uid.slice(0, 6)}`);
  await page.getByLabel("Password", { exact: true }).fill("E2ePassword123");
  await page.getByLabel("Confirm password").fill("E2ePassword123");
  await page.getByText("I agree to the").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/products\/iphone-13-128gb-uk-used/);

  // Pay Small-Small does not require verification or approval.
  await page.getByText("Pay Small-Small · 24 weeks").click();
  await page.getByRole("button", { name: /Buy on installments/ }).click();
  await page.getByText("I have read and agree").click();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page).toHaveURL(/\/account\/orders\/[a-f0-9]{24}/);

  // Deposit via sandbox checkout.
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await expect(page.getByText("Development sandbox")).toBeVisible();
  await page.getByRole("button", { name: "Approve payment" }).click();
  await expect(page.getByText("Payment confirmed")).toBeVisible();
  await page.getByRole("link", { name: "View my plan" }).click();
  const outstanding = page.getByTestId("outstanding-balance");
  await expect(outstanding).not.toHaveText("GH₵0.00");

  // A second order is blocked while this one is active.
  await page.goto("/products/iphone-15-128gb");
  await expect(page.getByText("You already have an active plan")).toBeVisible();
  await page.goBack();

  // A failed payment does not change the balance.
  const before = await outstanding.textContent();
  await page.getByRole("radio", { name: /Pay off full balance/ }).click();
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Payment not completed")).toBeVisible();
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page.getByTestId("outstanding-balance")).toHaveText(before!);

  // Pay off the balance.
  await page.getByRole("radio", { name: /Pay off full balance/ }).click();
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await page.getByRole("button", { name: "Approve payment" }).click();
  await page.getByRole("link", { name: "View my plan" }).click();
  await expect(page.getByTestId("outstanding-balance")).toHaveText("GH₵0.00");
  await expect(page.getByTestId("progress-percent")).toHaveText("100%");
});

test("admin dashboard uses live data and finance pages are role-gated", async ({ page }) => {
  await login(page, "sales@ipayghana.test", "Admin12345!");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText("Registered customers")).toBeVisible();
  await page.goto("/admin/payments");
  await expect(page).toHaveURL(/\/admin\?denied=1/); // sales officers cannot view payments
});
