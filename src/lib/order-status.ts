export const ORDER_STATUSES = [
  "submitted",
  "under_review",
  "awaiting_deposit",
  "awaiting_collection",
  "active_repayment",
  "fully_paid",
  "completed",
  "rejected",
  "cancelled",
  "suspended",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Terminal states. Every other state counts as an ACTIVE installment order. */
export const INACTIVE_ORDER_STATUSES: OrderStatus[] = ["completed", "rejected", "cancelled"];
export const isActiveOrderStatus = (s: OrderStatus) => !INACTIVE_ORDER_STATUSES.includes(s);

/** States in which the customer may make payments. */
export const PAYABLE_STATUSES: OrderStatus[] = ["awaiting_deposit", "awaiting_collection", "active_repayment"];

export const FULFILMENT_STATUSES = [
  "not_prepared",
  "preparing",
  "ready_for_collection",
  "collected",
  "delivered",
  "cancelled",
] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];
export const isHandedOver = (f: FulfilmentStatus) => f === "collected" || f === "delivered";

export const PAYMENT_STATUSES = ["pending", "processing", "confirmed", "failed", "expired", "refunded", "reversed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Allowed manual (staff/customer) transitions. System transitions (deposit, settlement) are applied by services. */
const MANUAL_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  submitted: ["under_review", "awaiting_deposit", "rejected", "cancelled"],
  under_review: ["awaiting_deposit", "rejected", "cancelled"],
  awaiting_deposit: ["cancelled"],
  awaiting_collection: ["active_repayment", "suspended", "cancelled"],
  active_repayment: ["suspended", "cancelled"],
  fully_paid: ["completed", "suspended"],
  suspended: ["awaiting_collection", "active_repayment", "fully_paid"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return MANUAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: "Application submitted",
  under_review: "Under review",
  awaiting_deposit: "Approved · awaiting deposit",
  awaiting_collection: "Awaiting collection",
  active_repayment: "Active repayment",
  fully_paid: "Fully paid",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  suspended: "Suspended",
};

export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  not_prepared: "Not prepared",
  preparing: "Preparing",
  ready_for_collection: "Ready for collection",
  collected: "Collected",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const REPAYMENT_LABEL: Record<string, string> = {
  not_started: "Not started",
  current: "Current",
  due_soon: "Due soon",
  overdue: "Overdue",
  partially_paid: "Partially paid",
  fully_paid: "Fully paid",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  confirmed: "Confirmed",
  failed: "Failed",
  expired: "Expired",
  refunded: "Refunded",
  reversed: "Reversed",
};

export const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  due: "Due soon",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
