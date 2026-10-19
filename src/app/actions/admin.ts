"use server";

import { revalidatePath } from "next/cache";
import type { FulfilmentStatus } from "@/lib/order-status";
import type { Role } from "@/lib/permissions";
import { ContactMessage, NotificationTemplate, Review, Setting } from "@/models";
import type { NotificationTemplateKey } from "@/models/Notification";
import { actorOrThrow, run, staffOrThrow } from "@/server/action";
import { connectDB } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/services/audit";
import * as customers from "@/server/services/customers";
import * as orders from "@/server/services/orders";
import * as payments from "@/server/services/payments";
import { savePlan } from "@/server/services/plans";
import * as products from "@/server/services/products";
import * as promos from "@/server/services/promotions";

const refreshAll = () => {
  revalidatePath("/", "layout");
};

/* ---------------- Orders ---------------- */
export async function orderAction(orderId: string, op: "review" | "approve" | "reject" | "cancel" | "suspend" | "resume" | "complete", note = "") {
  return run(async () => {
    const actor = await actorOrThrow();
    const id = String(orderId);
    switch (op) {
      case "review": await orders.startReview(actor, id); break;
      case "approve": await orders.approveOrder(actor, id, note); break;
      case "reject": await orders.rejectOrder(actor, id, note); break;
      case "cancel": await orders.cancelOrder(actor, id, note); break;
      case "suspend": await orders.suspendOrder(actor, id, note); break;
      case "resume": await orders.resumeOrder(actor, id, note); break;
      case "complete": await orders.completeOrder(actor, id); break;
    }
    refreshAll();
    return null;
  }, "Order updated.");
}

export async function fulfilmentAction(orderId: string, to: FulfilmentStatus, note = "") {
  return run(async () => {
    const actor = await actorOrThrow();
    await orders.updateFulfilment(actor, String(orderId), to, note);
    refreshAll();
    return null;
  }, "Fulfilment updated.");
}

/* ---------------- Payments ---------------- */
export async function manualPaymentAction(input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    const p = await payments.recordManualPayment(actor, input);
    refreshAll();
    return { reference: p.reference };
  }, "Manual payment recorded.");
}

export async function refundAction(input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    await payments.refundPayment(actor, input);
    refreshAll();
    return null;
  }, "Refund recorded.");
}

export async function reverifyAction(paymentId: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    const r = await payments.reverifyPayment(actor, String(paymentId));
    refreshAll();
    return r;
  });
}

export async function reconcileAction(paymentId: string, note: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await payments.markReconciled(actor, String(paymentId), String(note));
    refreshAll();
    return null;
  }, "Marked as resolved.");
}

/* ---------------- Products ---------------- */
export async function saveProductAction(productId: string | null, input: unknown, initialStock = 0) {
  return run(async () => {
    const actor = await actorOrThrow();
    const p = productId ? await products.updateProduct(actor, productId, input) : await products.createProduct(actor, input, Number(initialStock) || 0);
    refreshAll();
    return { id: p!._id.toString() };
  }, "Product saved.");
}

export async function productFlagsAction(productId: string, flags: Partial<{ isPublished: boolean; isFeatured: boolean; isAvailable: boolean; isArchived: boolean }>) {
  return run(async () => {
    const actor = await actorOrThrow();
    await products.setProductFlags(actor, String(productId), flags);
    refreshAll();
    return null;
  }, "Product updated.");
}

export async function stockAction(productId: string, input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    const { product } = await products.updateStock(actor, String(productId), input);
    refreshAll();
    return { stock: product.stockQuantity };
  }, "Stock updated.");
}

export async function deleteProductAction(productId: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    const r = await products.deleteProduct(actor, String(productId));
    refreshAll();
    return r;
  }, "Product deleted.");
}

/* ---------------- Plans ---------------- */
export async function savePlanAction(planId: string | null, input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    const p = await savePlan(actor, planId, input);
    refreshAll();
    return { id: p!._id.toString() };
  }, "Plan saved.");
}

/* ---------------- Promotions ---------------- */
export async function savePromotionAction(id: string | null, input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    const p = await promos.savePromotion(actor, id, input);
    refreshAll();
    return { id: p._id.toString() };
  }, "Campaign saved.");
}

export async function promotionStatusAction(id: string, status: "draft" | "published" | "archived") {
  return run(async () => {
    const actor = await actorOrThrow();
    await promos.setPromotionStatus(actor, String(id), status);
    refreshAll();
    return null;
  }, "Campaign updated.");
}

export async function reorderPromotionsAction(ids: string[]) {
  return run(async () => {
    const actor = await actorOrThrow();
    await promos.reorderPromotions(actor, ids.map(String));
    refreshAll();
    return null;
  });
}

/* ---------------- Customers & verification ---------------- */
export async function customerNoteAction(customerId: string, body: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await customers.addCustomerNote(actor, String(customerId), String(body));
    revalidatePath(`/admin/customers/${customerId}`);
    return null;
  }, "Note added.");
}

export async function accountStatusAction(customerId: string, status: "active" | "suspended", reason: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await customers.setAccountStatus(actor, String(customerId), status, String(reason));
    revalidatePath(`/admin/customers/${customerId}`);
    return null;
  }, status === "suspended" ? "Account suspended." : "Account reactivated.");
}

export async function reviewVerificationAction(verificationId: string, decision: "verified" | "rejected", note: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await customers.reviewVerification(actor, String(verificationId), decision, String(note ?? ""));
    refreshAll();
    return null;
  }, decision === "verified" ? "Customer verified." : "Verification rejected.");
}

/* ---------------- Staff ---------------- */
export async function createStaffAction(input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    const r = await customers.createStaff(actor, input);
    revalidatePath("/admin/staff");
    return { tempPassword: r.tempPassword, email: r.user.email };
  });
}

export async function changeRoleAction(userId: string, role: Role, reason: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await customers.changeRole(actor, String(userId), role, String(reason));
    revalidatePath("/admin/staff");
    return null;
  }, "Role updated. The user has been signed out.");
}

export async function staffStatusAction(userId: string, status: "active" | "suspended", reason: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await customers.setStaffStatus(actor, String(userId), status, String(reason));
    revalidatePath("/admin/staff");
    return null;
  }, "Staff status updated.");
}

/* ---------------- Settings, templates, inbox, reviews ---------------- */
export async function saveSettingsAction(input: Record<string, unknown>) {
  return run(async () => {
    const actor = await staffOrThrow("settings.manage");
    await connectDB();
    const s = input as {
      productsMenuLabel: string;
      takeAndPayEnabled: boolean;
      paySmallSmallEnabled: boolean;
      takeAndPaySummary: string;
      paySmallSmallSummary: string;
      reminderDaysBefore: number;
      pendingPaymentTtlMinutes: number;
      requireStaffMfa: boolean;
      supportPhone: string;
      supportWhatsapp: string;
      supportEmail: string;
      storeAddress: string;
    };
    if (!["Products & Offers", "Projects"].includes(s.productsMenuLabel)) throw new AppError("VALIDATION", "Invalid menu label.");
    const clean = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
    await Setting.updateOne(
      { _id: "global" },
      {
        $set: {
          productsMenuLabel: s.productsMenuLabel,
          "purchaseModels.take_and_pay.enabled": !!s.takeAndPayEnabled,
          "purchaseModels.take_and_pay.summary": clean(s.takeAndPaySummary),
          "purchaseModels.pay_small_small.enabled": !!s.paySmallSmallEnabled,
          "purchaseModels.pay_small_small.summary": clean(s.paySmallSmallSummary),
          reminderDaysBefore: Math.min(14, Math.max(0, Math.floor(Number(s.reminderDaysBefore) || 0))),
          pendingPaymentTtlMinutes: Math.min(1440, Math.max(10, Math.floor(Number(s.pendingPaymentTtlMinutes) || 60))),
          requireStaffMfa: !!s.requireStaffMfa,
          supportPhone: clean(s.supportPhone, 40),
          supportWhatsapp: clean(s.supportWhatsapp, 40),
          supportEmail: clean(s.supportEmail, 120),
          storeAddress: clean(s.storeAddress, 200),
        },
      },
      { upsert: true, runValidators: true },
    );
    await audit(actor, "settings.update", "Setting", "global", { metadata: input });
    refreshAll();
    return null;
  }, "Settings saved.");
}

export async function saveTemplateAction(key: NotificationTemplateKey, input: { subject: string; body: string; smsBody: string; enabled: boolean }) {
  return run(async () => {
    const actor = await staffOrThrow("notifications.manage");
    await connectDB();
    if (!input.subject?.trim() || !input.body?.trim() || !input.smsBody?.trim()) throw new AppError("VALIDATION", "Subject, email body and SMS body are required.");
    await NotificationTemplate.updateOne(
      { key },
      { $set: { subject: input.subject.slice(0, 200), body: input.body.slice(0, 4000), smsBody: input.smsBody.slice(0, 480), enabled: !!input.enabled, updatedBy: actor.userId } },
      { upsert: true, runValidators: true },
    );
    await audit(actor, "notification_template.update", "NotificationTemplate", key);
    revalidatePath("/admin/notifications");
    return null;
  }, "Template saved.");
}

export async function contactHandledAction(id: string) {
  return run(async () => {
    await staffOrThrow("customers.notes");
    await connectDB();
    await ContactMessage.updateOne({ _id: id }, { $set: { status: "handled" } });
    revalidatePath("/admin/notifications");
    return null;
  });
}

export async function moderateReviewAction(id: string, status: "approved" | "rejected") {
  return run(async () => {
    const actor = await staffOrThrow("promotions.manage");
    await connectDB();
    await Review.updateOne({ _id: id }, { $set: { status } });
    await audit(actor, `review.${status}`, "Review", String(id));
    refreshAll();
    return null;
  });
}
