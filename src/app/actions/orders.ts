"use server";

import { revalidatePath } from "next/cache";
import { actorOrThrow, appUrl, run } from "@/server/action";
import { createOrder, cancelOrder } from "@/server/services/orders";
import { initiatePayment, confirmPayment, getPaymentForActor } from "@/server/services/payments";

export async function applyForOrderAction(input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    const order = await createOrder(actor, input);
    revalidatePath("/account");
    return { orderId: order._id.toString(), redirectTo: `/account/orders/${order._id}?new=1` };
  });
}

export async function cancelMyOrderAction(orderId: string, reason: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await cancelOrder(actor, String(orderId), String(reason ?? ""));
    revalidatePath("/account");
    return null;
  }, "Your application has been cancelled.");
}

export async function startPaymentAction(input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    return initiatePayment(actor, input, appUrl());
  });
}

/** Called by the return page: re-verifies server-side (does not trust redirect query parameters). */
export async function checkPaymentAction(reference: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    const p = await getPaymentForActor(actor, String(reference));
    if (["pending", "processing", "expired"].includes(p.status)) {
      await confirmPayment(p.reference).catch(() => null);
    }
    const fresh = await getPaymentForActor(actor, String(reference));
    return { status: fresh.status, orderId: fresh.orderId.toString(), amount: fresh.amount, reference: fresh.reference };
  });
}

/** Genuine reviews only: one per completed order, moderated before display. */
export async function submitReviewAction(orderId: string, input: { rating: number; body: string; displayName: string }) {
  return run(async () => {
    const actor = await actorOrThrow();
    const { Order, Review } = await import("@/models");
    const { AppError } = await import("@/server/errors");
    if (!/^[a-f0-9]{24}$/i.test(String(orderId))) throw new AppError("NOT_FOUND", "Order not found.");
    const order = await Order.findOne({ _id: String(orderId), customerId: actor.userId, orderStatus: "completed" }).lean();
    if (!order) throw new AppError("NOT_FOUND", "Only completed orders can be reviewed.");
    const rating = Math.round(Number(input.rating));
    const body = String(input.body ?? "").trim();
    const displayName = String(input.displayName ?? "").trim().slice(0, 60);
    if (rating < 1 || rating > 5 || body.length < 10 || displayName.length < 2) throw new AppError("VALIDATION", "Add a rating, your name and at least 10 characters.");
    await Review.updateOne(
      { orderId: order._id },
      { $setOnInsert: { orderId: order._id, customerId: actor.userId, rating, body: body.slice(0, 600), displayName, status: "pending" } },
      { upsert: true },
    );
    return null;
  }, "Thanks! Your review will appear once it's approved.");
}
