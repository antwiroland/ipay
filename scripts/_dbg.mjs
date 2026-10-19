import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const b = await chromium.launch({ channel: "chrome" });
const errs = [];
async function session(email, pw, paths) {
  const p = await (await b.newContext()).newPage();
  p.setDefaultTimeout(120000);
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(`[${m.type()}] ${new URL(p.url()).pathname} ${m.text().slice(0, 300)}`); });
  p.on("pageerror", (e) => errs.push(`[pageerror] ${new URL(p.url()).pathname} ${e.message.slice(0, 300)}`));
  if (email) {
    await p.goto(`${BASE}/login`);
    await p.getByLabel("Email", { exact: true }).fill(email);
    await p.getByLabel("Password", { exact: true }).fill(pw);
    await p.getByRole("button", { name: "Log in" }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  }
  for (const path of paths) { await p.goto(BASE + path); await p.waitForTimeout(1500); }
}
await session(null, null, ["/", "/shop"]);
await session("ama@example.com", "Customer123!", ["/account", "/account/orders", "/account/orders/6ad57a47e8d04a6204ac2440", "/account/payments", "/account/installments", "/account/profile", "/account/notifications", "/products/iphone-15-128gb"]);
await session("superadmin@ipayghana.test", "Admin12345!", ["/admin", "/admin/products", "/admin/orders", "/admin/orders/6ad57a47e8d04a6204ac2440", "/admin/customers", "/admin/payments", "/admin/installments", "/admin/promotions", "/admin/promotions/new", "/admin/reports", "/admin/notifications", "/admin/staff", "/admin/settings", "/admin/plans/new", "/admin/products/new"]);
console.log([...new Set(errs)].join("\n") || "no console errors or warnings");
await b.close();
