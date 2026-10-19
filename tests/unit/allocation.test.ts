import { describe, expect, it } from "vitest";
import { allocatePayment, deriveInstallmentStatus, deriveRepaymentStatus, unwindAllocations } from "@/lib/allocation";
import { canTransition, isActiveOrderStatus } from "@/lib/order-status";
import { hasPermission } from "@/lib/permissions";

const inst = (n: number, due: number, paid = 0) => ({ id: `i${n}`, installmentNumber: n, amountDue: due, amountPaid: paid });

describe("allocation policy", () => {
  it("pays oldest installment first and rolls over", () => {
    const r = allocatePayment(80000, [inst(2, 33000), inst(1, 33000, 10000), inst(3, 33000)]);
    expect(r.allocations).toEqual([
      { installmentId: "i1", installmentNumber: 1, amount: 23000 },
      { installmentId: "i2", installmentNumber: 2, amount: 33000 },
      { installmentId: "i3", installmentNumber: 3, amount: 24000 },
    ]);
    expect(r.unallocated).toBe(0);
  });

  it("never over-allocates — excess is held as unallocated", () => {
    const r = allocatePayment(100000, [inst(1, 33000), inst(2, 33000)]);
    expect(r.allocations.reduce((s, a) => s + a.amount, 0)).toBe(66000);
    expect(r.unallocated).toBe(34000);
  });

  it("skips cancelled installments", () => {
    const r = allocatePayment(10000, [{ ...inst(1, 33000), cancelled: true }, inst(2, 33000)]);
    expect(r.allocations[0].installmentNumber).toBe(2);
  });

  it("unwinds newest-first for refunds", () => {
    const r = unwindAllocations(40000, [inst(1, 33000, 33000), inst(2, 33000, 33000), inst(3, 33000, 5000)]);
    expect(r.allocations).toEqual([
      { installmentId: "i3", installmentNumber: 3, amount: -5000 },
      { installmentId: "i2", installmentNumber: 2, amount: -33000 },
      { installmentId: "i1", installmentNumber: 1, amount: -2000 },
    ]);
    expect(r.unresolved).toBe(0);
  });
});

describe("status derivation", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it("derives installment status from dates and amounts", () => {
    const base = { amountDue: 33000, amountPaid: 0 };
    expect(deriveInstallmentStatus({ ...base, dueDate: new Date("2026-11-30") }, now)).toBe("upcoming");
    expect(deriveInstallmentStatus({ ...base, dueDate: new Date("2026-10-21") }, now)).toBe("due");
    expect(deriveInstallmentStatus({ ...base, dueDate: new Date("2026-10-17") }, now, 3)).toBe("due"); // past due but inside the 3-day grace window
    expect(deriveInstallmentStatus({ ...base, dueDate: new Date("2026-10-15") }, now, 3)).toBe("overdue"); // grace ended at the start of 19 Oct
    expect(deriveInstallmentStatus({ ...base, dueDate: new Date("2026-10-10") }, now, 3)).toBe("overdue");
    expect(deriveInstallmentStatus({ ...base, amountPaid: 1000, dueDate: new Date("2026-11-30") }, now)).toBe("partially_paid");
    expect(deriveInstallmentStatus({ ...base, amountPaid: 33000, dueDate: new Date("2026-10-10") }, now)).toBe("paid");
  });

  it("derives order repayment status", () => {
    const i = [{ amountDue: 1, amountPaid: 0, dueDate: new Date("2026-10-01") }];
    expect(deriveRepaymentStatus({ depositPaid: false, outstanding: 10, installments: i }, now)).toBe("not_started");
    expect(deriveRepaymentStatus({ depositPaid: true, outstanding: 0, installments: i }, now)).toBe("fully_paid");
    expect(deriveRepaymentStatus({ depositPaid: true, outstanding: 1, installments: i }, now)).toBe("overdue");
  });
});

describe("order lifecycle", () => {
  it("treats every non-terminal status as active", () => {
    expect(isActiveOrderStatus("awaiting_deposit")).toBe(true);
    expect(isActiveOrderStatus("fully_paid")).toBe(true); // awaiting collection still blocks a new order
    expect(isActiveOrderStatus("suspended")).toBe(true);
    expect(isActiveOrderStatus("completed")).toBe(false);
    expect(isActiveOrderStatus("rejected")).toBe(false);
  });
  it("forbids skipping to completed", () => {
    expect(canTransition("active_repayment", "completed")).toBe(false);
    expect(canTransition("submitted", "completed")).toBe(false);
    expect(canTransition("completed", "active_repayment")).toBe(false);
  });
});

describe("permissions", () => {
  it("applies least privilege", () => {
    expect(hasPermission("sales_officer", "products.manage")).toBe(true);
    expect(hasPermission("sales_officer", "payments.refund")).toBe(false);
    expect(hasPermission("sales_officer", "payments.export")).toBe(false);
    expect(hasPermission("finance_officer", "payments.refund")).toBe(true);
    expect(hasPermission("support", "payments.manual")).toBe(false);
    expect(hasPermission("admin", "staff.manage")).toBe(false);
    expect(hasPermission("super_admin", "staff.manage")).toBe(true);
    expect(hasPermission("customer", "admin.access")).toBe(false);
  });
});
