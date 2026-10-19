import { Badge } from "@/components/ui/badge";
import {
  FULFILMENT_LABEL,
  INSTALLMENT_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  REPAYMENT_LABEL,
  type FulfilmentStatus,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "dark" | "grey";

const ORDER_TONE: Record<OrderStatus, Tone> = {
  submitted: "info",
  under_review: "info",
  awaiting_deposit: "warning",
  awaiting_collection: "accent",
  active_repayment: "accent",
  fully_paid: "success",
  completed: "success",
  rejected: "danger",
  cancelled: "grey",
  suspended: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]} dot>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone: Tone = status === "confirmed" ? "success" : status === "failed" ? "danger" : status === "pending" || status === "processing" ? "warning" : "grey";
  return <Badge tone={tone} dot>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

/** Green paid · Blue upcoming · Amber due soon · Red overdue · Grey cancelled */
export function InstallmentStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "paid" ? "success" : status === "upcoming" ? "info" : status === "due" || status === "partially_paid" ? "warning" : status === "overdue" ? "danger" : "grey";
  return <Badge tone={tone} dot>{INSTALLMENT_STATUS_LABEL[status] ?? status}</Badge>;
}

export function RepaymentStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "fully_paid" ? "success" : status === "overdue" ? "danger" : status === "due_soon" || status === "partially_paid" ? "warning" : status === "current" ? "info" : "grey";
  return <Badge tone={tone}>{REPAYMENT_LABEL[status] ?? status}</Badge>;
}

export function FulfilmentBadge({ status }: { status: FulfilmentStatus }) {
  const tone: Tone = status === "collected" || status === "delivered" ? "success" : status === "ready_for_collection" ? "accent" : status === "cancelled" ? "grey" : "neutral";
  return <Badge tone={tone}>{FULFILMENT_LABEL[status]}</Badge>;
}

export function SandboxBadge() {
  return (
    <Badge tone="warning" className="font-semibold tracking-wide uppercase" title="Development sandbox — not a real payment">
      Dev sandbox
    </Badge>
  );
}
