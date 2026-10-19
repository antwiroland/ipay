/**
 * Development seed. Usage: npm run seed   (add -- --reset to wipe the database first)
 * Orders and payments are created through the real services (sandbox provider), so balances,
 * schedules and the ledger are internally consistent.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import * as models from "@/models";
import { PaymentPlan, Product, Promotion, Setting, User } from "@/models";
import { hashPassword } from "@/server/auth/crypto";
import { connectDB } from "@/server/db";
import { setMockOutcome } from "@/server/payments/mock";
import { TERMS_VERSION, toActor } from "@/server/services/auth";
import { createOrder, updateFulfilment } from "@/server/services/orders";
import { confirmPayment, initiatePayment } from "@/server/services/payments";
import { bannerSvg, deviceSvg, type CameraStyle } from "./device-art";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
// Demo payments are always created with the sandbox provider (stored isTest=true, labelled "Dev sandbox"),
// even when the app itself is configured for Paystack. Never run this seed against production.
if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
process.env.PAYMENT_PROVIDER = "mock";
const PUBLIC = path.join(process.cwd(), "public", "images");
const cedi = (n: number) => Math.round(n * 100);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const TERMS = `iPay Ghana Installment Purchase Agreement

1. Contract price. The total amount payable is fixed when you submit your application and shown on your order. It will not change if product prices change later.
2. Deposit. Your plan starts when the required deposit has been confirmed by our payment provider.
3. Schedule. Installments fall due on the dates shown in your repayment schedule. You may pay early.
4. Allocation. Each confirmed payment settles your oldest outstanding installment first, then the next. Payments above your outstanding balance are refunded.
5. Late payment. There is a grace period after each due date. iPay Ghana does not charge automatic late fees; we will contact you respectfully to agree a way forward.
6. Ownership. The device remains the property of iPay Ghana until the contract price has been paid in full.
7. One plan at a time. You may hold one active installment plan. You can apply for another device once your current plan is completed.
8. Cancellation. You may cancel online before paying your deposit. After that, contact support.
9. Privacy. We process your personal data in line with our Privacy Policy and the Data Protection Act, 2012 (Act 843).`;

const PLANS = [
  { name: "Take & Pay · 12 weeks", code: "tp-weekly-12", purchaseModel: "take_and_pay", depositType: "percentage", depositValue: 4000, frequency: "weekly", numberOfInstallments: 12, markupBps: 0, description: "40% deposit, take your iPhone home, 12 weekly payments.", eligibility: { requiresVerification: true, requiresApproval: true, minAccountAgeDays: 0 }, sortOrder: 1 },
  { name: "Take & Pay · 6 months", code: "tp-monthly-6", purchaseModel: "take_and_pay", depositType: "percentage", depositValue: 5000, frequency: "monthly", numberOfInstallments: 6, markupBps: 300, description: "50% deposit, 6 monthly payments. 3% financing charge.", eligibility: { requiresVerification: true, requiresApproval: true, minAccountAgeDays: 0 }, sortOrder: 2 },
  { name: "Pay Small-Small · 24 weeks", code: "pss-weekly-24", purchaseModel: "pay_small_small", depositType: "percentage", depositValue: 2000, frequency: "weekly", numberOfInstallments: 24, markupBps: 0, description: "Start with 20%. We keep your iPhone safe until it's fully paid.", eligibility: { requiresVerification: false, requiresApproval: false, minAccountAgeDays: 0 }, sortOrder: 3 },
  { name: "Pay Small-Small · 10 months", code: "pss-monthly-10", purchaseModel: "pay_small_small", depositType: "percentage", depositValue: 1000, frequency: "monthly", numberOfInstallments: 10, markupBps: 0, description: "Just 10% to start, 10 monthly contributions.", eligibility: { requiresVerification: false, requiresApproval: false, minAccountAgeDays: 0 }, sortOrder: 4 },
] as const;

type Spec = {
  model: string; series: number; storage: string; condition: "brand_new" | "uk_used"; cash: number; inst: number; cost: number;
  stock: number; featured?: boolean; camera: CameraStyle; colours: [string, string][]; specs: [string, string][]; daysAgo: number;
  promo?: number; desc: string;
};

const PRODUCTS: Spec[] = [
  { model: "iPhone 17 Pro Max", series: 17, storage: "256GB", condition: "brand_new", cash: 23500, inst: 26800, cost: 20900, stock: 6, featured: true, camera: "plateau-pro", colours: [["Cosmic Orange", "#e0763a"], ["Deep Blue", "#2c3e63"], ["Silver", "#d9dadc"]], specs: [["Display", "6.9″ Super Retina XDR, ProMotion 120Hz"], ["Chip", "A19 Pro"], ["Camera", "48MP Pro Fusion triple camera"], ["Battery", "Up to 37 hours video playback"], ["Build", "Aluminium unibody, Ceramic Shield 2"]], daysAgo: 20, desc: "The biggest, longest-lasting iPhone yet, with a pro camera system built for creators." },
  { model: "iPhone 17 Pro", series: 17, storage: "256GB", condition: "brand_new", cash: 20500, inst: 23400, cost: 18200, stock: 8, featured: true, camera: "plateau-pro", colours: [["Deep Blue", "#2c3e63"], ["Cosmic Orange", "#e0763a"], ["Silver", "#d9dadc"]], specs: [["Display", "6.3″ Super Retina XDR, ProMotion 120Hz"], ["Chip", "A19 Pro"], ["Camera", "48MP Pro Fusion triple camera"], ["Build", "Aluminium unibody"]], daysAgo: 22, desc: "Pro performance and cameras in a size that fits comfortably in one hand." },
  { model: "iPhone Air", series: 17, storage: "256GB", condition: "brand_new", cash: 18200, inst: 20900, cost: 16100, stock: 4, camera: "plateau-air", colours: [["Sky Blue", "#b9d3ea"], ["Space Black", "#26272b"], ["Cloud White", "#ecebe6"]], specs: [["Display", "6.5″ ProMotion"], ["Chip", "A19 Pro"], ["Camera", "48MP Fusion"], ["Thickness", "5.6 mm"]], daysAgo: 25, desc: "Remarkably thin and light, without compromising on power." },
  { model: "iPhone 17", series: 17, storage: "256GB", condition: "brand_new", cash: 14800, inst: 17000, cost: 13000, stock: 10, featured: true, camera: "dual-vertical", colours: [["Lavender", "#c9bfe3"], ["Sage", "#b7c4a8"], ["Mist Blue", "#a9bfd6"], ["Black", "#23252a"]], specs: [["Display", "6.3″ ProMotion 120Hz"], ["Chip", "A19"], ["Camera", "48MP Dual Fusion"], ["Storage", "256GB"]], daysAgo: 24, desc: "A brilliant all-rounder with a smooth 120Hz display and all-day battery." },
  { model: "iPhone 16 Pro", series: 16, storage: "128GB", condition: "uk_used", cash: 13200, inst: 15200, cost: 11400, stock: 5, camera: "pro-triple", colours: [["Desert Titanium", "#bfa48a"], ["Natural Titanium", "#b9b4ab"], ["Black Titanium", "#3a3a3c"]], specs: [["Display", "6.3″ ProMotion"], ["Chip", "A18 Pro"], ["Camera", "48MP triple, 5× telephoto"], ["Grade", "UK used · Grade A, battery health ≥ 90%"]], daysAgo: 60, promo: 14400, desc: "Carefully inspected UK-used iPhone 16 Pro in excellent condition." },
  { model: "iPhone 16", series: 16, storage: "128GB", condition: "brand_new", cash: 11900, inst: 13700, cost: 10300, stock: 7, camera: "dual-vertical", colours: [["Ultramarine", "#5b6fd6"], ["Teal", "#7fbcb5"], ["Pink", "#efb8cf"], ["White", "#f0efea"]], specs: [["Display", "6.1″ Super Retina XDR"], ["Chip", "A18"], ["Camera", "48MP Fusion + Ultra Wide"], ["Action", "Camera Control"]], daysAgo: 90, desc: "Bold colours, Camera Control and the A18 chip." },
  { model: "iPhone 15 Pro Max", series: 15, storage: "256GB", condition: "uk_used", cash: 12400, inst: 14300, cost: 10800, stock: 3, camera: "pro-triple", colours: [["Blue Titanium", "#3f4a5c"], ["Natural Titanium", "#b9b4ab"]], specs: [["Display", "6.7″ ProMotion"], ["Chip", "A17 Pro"], ["Camera", "48MP triple, 5× telephoto"], ["Grade", "UK used · Grade A"]], daysAgo: 120, desc: "Titanium design and 5× zoom — a pro favourite at a friendlier price." },
  { model: "iPhone 15", series: 15, storage: "128GB", condition: "brand_new", cash: 9800, inst: 11300, cost: 8500, stock: 6, camera: "dual-diagonal", colours: [["Blue", "#c9d6e3"], ["Green", "#cfe0cd"], ["Black", "#2b2d31"]], specs: [["Display", "6.1″ Super Retina XDR"], ["Chip", "A16 Bionic"], ["Camera", "48MP Main"], ["Port", "USB-C"]], daysAgo: 150, desc: "Dynamic Island, a 48MP camera and USB-C." },
  { model: "iPhone 14 Pro", series: 14, storage: "128GB", condition: "uk_used", cash: 8200, inst: 9500, cost: 7000, stock: 4, camera: "pro-triple", colours: [["Deep Purple", "#4b3f5c"], ["Space Black", "#2f2f33"]], specs: [["Display", "6.1″ ProMotion"], ["Chip", "A16 Bionic"], ["Camera", "48MP triple"], ["Grade", "UK used · Grade A"]], daysAgo: 200, desc: "Always-On display and pro cameras, fully tested." },
  { model: "iPhone 13", series: 13, storage: "128GB", condition: "uk_used", cash: 5500, inst: 6600, cost: 4500, stock: 9, featured: true, camera: "dual-diagonal", colours: [["Midnight", "#1f2430"], ["Starlight", "#f1ebe1"], ["Blue", "#3d5a80"]], specs: [["Display", "6.1″ Super Retina XDR"], ["Chip", "A15 Bionic"], ["Camera", "12MP dual"], ["Grade", "UK used · Grade A, battery health ≥ 88%"]], daysAgo: 260, desc: "Our most popular plan device: dependable, fast and great value." },
  { model: "iPhone 12", series: 12, storage: "64GB", condition: "uk_used", cash: 3900, inst: 4700, cost: 3200, stock: 0, camera: "dual-vertical", colours: [["Black", "#24262b"], ["White", "#f2f1ed"]], specs: [["Display", "6.1″ Super Retina XDR"], ["Chip", "A14 Bionic"], ["Camera", "12MP dual"], ["Grade", "UK used · Grade B"]], daysAgo: 300, desc: "An affordable way into iPhone. Restocking soon." },
];

async function writeArt() {
  mkdirSync(path.join(PUBLIC, "devices"), { recursive: true });
  mkdirSync(path.join(PUBLIC, "banners"), { recursive: true });
  for (const p of PRODUCTS) {
    for (const [name, hex] of p.colours) {
      const file = `${slugify(p.model)}-${slugify(name)}.svg`;
      writeFileSync(path.join(PUBLIC, "devices", file), deviceSvg({ colour: hex, camera: p.camera, label: `${p.model} in ${name}`, id: slugify(name).slice(0, 6) }));
    }
  }
  writeFileSync(path.join(PUBLIC, "devices", "placeholder.svg"), deviceSvg({ colour: "#c8ccd4", camera: "dual-vertical", label: "iPhone", id: "ph" }));
  writeFileSync(path.join(PUBLIC, "banners", "launch-desktop.svg"), bannerSvg({ title: "iPhone 17 launch", colourA: "#3b5bff", colourB: "#8b5cf6" }));
  writeFileSync(path.join(PUBLIC, "banners", "launch-mobile.svg"), bannerSvg({ title: "iPhone 17 launch", colourA: "#3b5bff", colourB: "#8b5cf6", mobile: true }));
  writeFileSync(path.join(PUBLIC, "banners", "students-desktop.svg"), bannerSvg({ title: "Student season", colourA: "#0ea5e9", colourB: "#22c55e" }));
  writeFileSync(path.join(PUBLIC, "banners", "students-mobile.svg"), bannerSvg({ title: "Student season", colourA: "#0ea5e9", colourB: "#22c55e", mobile: true }));
}

async function user(name: string, email: string, phone: string, role: models.IUser["role"], extra: Partial<models.IUser> = {}) {
  const now = new Date();
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({
    name, email, phone, role,
    passwordHash: await hashPassword(role === "customer" ? "Customer123!" : "Admin12345!"),
    verificationStatus: role === "customer" ? "verified" : "unverified",
    consents: { termsAcceptedAt: now, privacyAcceptedAt: now, termsVersion: TERMS_VERSION },
    ...extra,
  });
}

async function payAs(actor: ReturnType<typeof toActor>, orderId: string, kind: "deposit" | "installment" | "additional" | "full_balance", amount?: string) {
  const r = await initiatePayment(actor, { orderId, kind, amount }, APP_URL);
  await setMockOutcome(r.reference, "success", Math.random() > 0.3 ? "mobile_money" : "card");
  await confirmPayment(r.reference);
}

async function main() {
  await connectDB();
  if (process.argv.includes("--reset")) {
    await mongoose.connection.dropDatabase();
    console.log("✔ database dropped");
  }
  for (const m of Object.values(models)) {
    if (typeof m === "function" && "init" in m && "modelName" in m) await (m as unknown as mongoose.Model<unknown>).init();
  }
  await writeArt();
  console.log("✔ device renders written to public/images");

  await Setting.updateOne({ _id: "global" }, { $setOnInsert: { _id: "global" } }, { upsert: true });

  const plans = [];
  for (const p of PLANS) {
    plans.push(
      await PaymentPlan.findOneAndUpdate(
        { code: p.code },
        { $setOnInsert: { ...p, fees: [], gracePeriodDays: 3, latePaymentPolicy: "No automatic late fees. After the grace period we will contact you to agree a plan.", allowPartialPayments: true, allowAdditionalPayments: true, termsVersion: "2026.1", termsText: TERMS, isActive: true } },
        { upsert: true, returnDocument: "after" },
      ),
    );
  }
  console.log(`✔ ${plans.length} payment plans`);

  for (const p of PRODUCTS) {
    const slug = slugify(`${p.model} ${p.storage} ${p.condition === "uk_used" ? "uk used" : ""}`);
    const created = new Date(Date.now() - p.daysAgo * 86400000);
    await Product.updateOne(
      { slug },
      {
        $setOnInsert: {
          name: `${p.model} ${p.storage}`,
          slug,
          description: p.desc,
          model: p.model,
          series: p.series,
          storage: p.storage,
          storageGb: parseInt(p.storage, 10),
          colourOptions: p.colours.map(([name, hex]) => ({ name, hex })),
          condition: p.condition,
          images: p.colours.map(([name]) => ({ url: `/images/devices/${slugify(p.model)}-${slugify(name)}.svg`, alt: `${p.model} in ${name}` })),
          specs: p.specs.map(([label, value]) => ({ label, value })),
          cashPrice: cedi(p.cash),
          installmentPrice: cedi(p.inst),
          costPrice: cedi(p.cost),
          promoInstallmentPrice: p.promo ? cedi(p.promo) : null,
          promoStartsAt: p.promo ? new Date(Date.now() - 3 * 86400000) : null,
          promoEndsAt: p.promo ? new Date(Date.now() + 21 * 86400000) : null,
          addOns: [
            { key: "case", name: "MagSafe-compatible clear case", price: cedi(180) },
            { key: "screen", name: "Tempered glass screen protector (fitted)", price: cedi(90) },
            { key: "charger", name: "20W USB-C fast charger", price: cedi(250) },
          ],
          stockQuantity: p.stock,
          isFeatured: !!p.featured,
          isPublished: true,
          isAvailable: true,
          publishedAt: created,
          createdAt: created,
        },
      },
      { upsert: true, timestamps: false },
    );
  }
  console.log(`✔ ${PRODUCTS.length} products`);


  await user("Super Admin", "superadmin@ipayghana.test", "+233200000001", "super_admin");
  await user("Akosua Admin", "admin@ipayghana.test", "+233200000002", "admin");
  await user("Fiifi Finance", "finance@ipayghana.test", "+233200000003", "finance_officer");
  await user("Selorm Sales", "sales@ipayghana.test", "+233200000004", "sales_officer");
  await user("Serwaa Support", "support@ipayghana.test", "+233200000005", "support");
  const sales = toActor((await User.findOne({ email: "sales@ipayghana.test" }).lean())!, true);

  // Demo customers covering each state.
  const ama = await user("Ama Owusu", "ama@example.com", "+233241110001", "customer");
  const kwame = await user("Kwame Asante", "kwame@example.com", "+233241110002", "customer");
  const efua = await user("Efua Boateng", "efua@example.com", "+233241110003", "customer");
  const yaw = await user("Yaw Darko", "yaw@example.com", "+233241110004", "customer", { verificationStatus: "unverified" });
  await user("Abena Nyarko", "abena@example.com", "+233241110005", "customer", { verificationStatus: "pending" });

  const models_ = await import("@/models");
  if (!(await models_.Order.exists({}))) {
    const iphone13 = (await Product.findOne({ slug: "iphone-13-128gb-uk-used" }).lean())!;
    const iphone16 = (await Product.findOne({ slug: "iphone-16-128gb" }).lean())!;
    const iphone17 = (await Product.findOne({ slug: "iphone-17-256gb" }).lean())!;
    const tp12 = plans.find((p) => p!.code === "tp-weekly-12")!;
    const pss24 = plans.find((p) => p!.code === "pss-weekly-24")!;
    const { approveOrder } = await import("@/server/services/orders");

    // Ama — the specification example: iPhone 13 at GH₵6,600, deposit 2,640 + 4 × 330 = 3,960 paid → 60%.
    // (Orders are seeded before the iPhone 13 campaign discount goes live, so the contract is the list price.)
    const amaA = toActor(ama, true);
    const o1 = await createOrder(amaA, { productId: iphone13._id.toString(), planId: tp12!._id.toString(), colour: "Midnight", acceptTerms: true, termsVersion: "2026.1", addOnKeys: [] });
    await approveOrder(sales, o1.id, "Documents verified in store");
    await payAs(amaA, o1.id, "deposit");
    await updateFulfilment(sales, o1.id, "collected", "Collected at Osu store");
    await payAs(amaA, o1.id, "installment");
    await payAs(amaA, o1.id, "installment");
    await payAs(amaA, o1.id, "installment");
    await payAs(amaA, o1.id, "installment");

    // Kwame — completed plan (eligible for a new order).
    const kwA = toActor(kwame, true);
    const o2 = await createOrder(kwA, { productId: iphone16._id.toString(), planId: tp12!._id.toString(), colour: "Teal", acceptTerms: true, termsVersion: "2026.1", addOnKeys: ["case"] });
    await approveOrder(sales, o2.id);
    await payAs(kwA, o2.id, "deposit");
    await updateFulfilment(sales, o2.id, "collected", "Collected at Kumasi partner store");
    await payAs(kwA, o2.id, "full_balance");

    // Efua — Pay Small-Small in progress (device in storage).
    const efA = toActor(efua, true);
    const o3 = await createOrder(efA, { productId: iphone17._id.toString(), planId: pss24!._id.toString(), colour: "Lavender", acceptTerms: true, termsVersion: "2026.1", addOnKeys: [] });
    await payAs(efA, o3.id, "deposit");
    await payAs(efA, o3.id, "additional", "1500");

    // Yaw — Pay Small-Small application awaiting deposit (no verification needed for this plan).
    const yA = toActor(yaw, true);
    await createOrder(yA, { productId: iphone13._id.toString(), planId: pss24!._id.toString(), colour: "Blue", acceptTerms: true, termsVersion: "2026.1", addOnKeys: [] });
    console.log("✔ demo orders and sandbox payments");
  }

  const now = new Date();
  const productIds = await Product.find({ isFeatured: true }).select("_id").lean();
  if (!(await Promotion.exists({}))) {
    await Promotion.create([
      { title: "The new iPhone 17 line-up is here", subtitle: "Start with a 20% deposit on Pay Small-Small, or take it home today with Take & Pay.", badge: "Just landed", desktopImage: "/images/banners/launch-desktop.svg", mobileImage: "/images/banners/launch-mobile.svg", callToAction: "Explore iPhone 17", destinationType: "url", destination: "/shop?series=17", linkedProductIds: productIds.map((p) => p._id), startDate: new Date(now.getTime() - 10 * 86400000), endDate: new Date(now.getTime() + 40 * 86400000), status: "published", displayOrder: 0 },
      { title: "Student season: 10% off iPhone 13", subtitle: "Back-to-campus pricing on our most popular plan device. Ends soon.", badge: "Limited time", desktopImage: "/images/banners/students-desktop.svg", mobileImage: "/images/banners/students-mobile.svg", callToAction: "See the offer", destinationType: "product", destination: "iphone-13-128gb-uk-used", linkedProductIds: [(await Product.findOne({ slug: "iphone-13-128gb-uk-used" }).lean())!._id], discountBps: 1000, startDate: new Date(now.getTime() - 2 * 86400000), endDate: new Date(now.getTime() + 12 * 86400000), status: "published", displayOrder: 1, showCountdown: true },
      { title: "Black Friday preview", subtitle: "Scheduled campaign — not yet live.", desktopImage: "/images/banners/launch-desktop.svg", mobileImage: "/images/banners/launch-mobile.svg", callToAction: "Shop deals", destinationType: "url", destination: "/promotions", startDate: new Date(now.getTime() + 30 * 86400000), endDate: new Date(now.getTime() + 37 * 86400000), status: "published", displayOrder: 2 },
    ]);
  }
  console.log("✔ promotions");

  console.log(`
Done. Sign in at ${APP_URL}/login
  Customers:  ama@example.com · kwame@example.com · efua@example.com · yaw@example.com  (password Customer123!)
  Staff:      superadmin@ / admin@ / finance@ / sales@ / support@ipayghana.test        (password Admin12345!)
`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
