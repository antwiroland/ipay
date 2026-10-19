import { NextResponse } from "next/server";
import { formatDate } from "@/lib/dates";
import { pesewasToCedisString } from "@/lib/money";
import { hasPermission, type Permission } from "@/lib/permissions";
import { getActor } from "@/server/auth/session";
import { listInstallments, listOrders, listPayments } from "@/server/services/admin-queries";
import { audit } from "@/server/services/audit";
import { listCustomers } from "@/server/services/customers";
import { financialReport, toCsv } from "@/server/services/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;
const cedi = (v: number | null | undefined) => (v == null ? "" : pesewasToCedisString(v));

const PERMS: Record<string, Permission[]> = {
  payments: ["payments.export"],
  orders: ["reports.export"],
  installments: ["reports.export"],
  customers: ["reports.export", "customers.pii"],
  collections: ["reports.export"],
  sales: ["reports.export"],
};

/** CSV exports. Every export is permission-checked and written to the audit log. */
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const perms = PERMS[type];
  if (!perms) return NextResponse.json({ error: "unknown export" }, { status: 404 });
  if (!perms.every((p) => hasPermission(actor.role, p))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string>;
  delete sp.page;
  let csv = "";
  let rows = 0;

  if (type === "payments") {
    const { items } = await listPayments(actor, sp, MAX_ROWS);
    rows = items.length;
    csv = toCsv(
      items.map((p) => ({ ...p, customer: p.customer?.name, amount: cedi(p.amount), allocated: cedi(p.allocatedAmount), unallocated: cedi(p.unallocatedAmount), refunded: cedi(p.refundedAmount), createdAt: p.createdAt, verifiedAt: p.verifiedAt ?? "" })),
      [
        { key: "reference", label: "Reference" }, { key: "providerReference", label: "Provider reference" }, { key: "customer", label: "Customer" }, { key: "orderNumber", label: "Order" },
        { key: "kind", label: "Type" }, { key: "amount", label: "Amount (GHS)" }, { key: "allocated", label: "Applied (GHS)" }, { key: "unallocated", label: "Unallocated (GHS)" }, { key: "refunded", label: "Refunded (GHS)" },
        { key: "currency", label: "Currency" }, { key: "provider", label: "Provider" }, { key: "method", label: "Method" }, { key: "status", label: "Status" },
        { key: "reconciliationStatus", label: "Reconciliation" }, { key: "isTest", label: "Sandbox" }, { key: "createdAt", label: "Created" }, { key: "verifiedAt", label: "Verified" },
      ],
    );
  } else if (type === "orders") {
    const { items } = await listOrders(actor, sp, MAX_ROWS);
    rows = items.length;
    csv = toCsv(
      items.map((o) => ({ orderNumber: o.orderNumber, customer: o.customer?.name, product: o.productSnapshot.name, plan: o.planSnapshot.name, contract: cedi(o.agreedPurchasePrice), deposit: cedi(o.depositAmount), paid: cedi(o.amountPaid), outstanding: cedi(o.outstandingBalance), applied: formatDate(o.createdAt), nextDue: o.nextDueDate ? formatDate(o.nextDueDate) : "", status: o.orderStatus, repayment: o.repaymentStatus, fulfilment: o.fulfilmentStatus })),
      ["orderNumber", "customer", "product", "plan", "contract", "deposit", "paid", "outstanding", "applied", "nextDue", "status", "repayment", "fulfilment"].map((k) => ({ key: k, label: k })),
    );
  } else if (type === "installments") {
    const { items } = await listInstallments(actor, sp, MAX_ROWS);
    rows = items.length;
    csv = toCsv(
      items.map((r) => ({ customer: r.customer?.name, order: r.orderNumber, product: r.order?.productSnapshot?.name, number: r.installmentNumber, due: formatDate(r.dueDate), amountDue: cedi(r.amountDue), paid: cedi(r.amountPaid), remaining: cedi(r.outstandingAmount), orderBalance: cedi(r.order?.outstandingBalance), status: r.live, lastPayment: r.lastPaymentAt ? formatDate(r.lastPaymentAt) : "" })),
      ["customer", "order", "product", "number", "due", "amountDue", "paid", "remaining", "orderBalance", "status", "lastPayment"].map((k) => ({ key: k, label: k })),
    );
  } else if (type === "customers") {
    const all = [];
    for (let page = 1; page <= 100; page++) {
      const r = await listCustomers(actor, { q: sp.q, verification: sp.verification, status: sp.status, hasActive: sp.active, page, pageSize: 100 });
      all.push(...r.items);
      if (r.items.length < 100) break;
    }
    rows = all.length;
    csv = toCsv(
      all.map((c) => ({ ...c, totalPaid: cedi(c.totalPaid), outstanding: cedi(c.outstanding), activeOrder: c.activeOrder?.orderNumber ?? "" })),
      ["id", "name", "email", "phone", "createdAt", "verificationStatus", "accountStatus", "activeOrder", "totalPaid", "outstanding"].map((k) => ({ key: k, label: k })),
    );
  } else {
    const from = sp.from ? new Date(sp.from) : new Date(Date.now() - 180 * 86400000);
    const to = sp.to ? new Date(new Date(sp.to).getTime() + 86400000 - 1) : new Date();
    const g = sp.g === "day" || sp.g === "week" ? sp.g : "month";
    const r = await financialReport(actor, { from, to, granularity: g });
    if (type === "collections") {
      rows = r.collections.length;
      csv = toCsv(r.collections.map((c) => ({ period: c.period, gross: cedi(c.gross), refunds: cedi(c.refunds), net: cedi(c.net), entries: c.count })), ["period", "gross", "refunds", "net", "entries"].map((k) => ({ key: k, label: k })));
    } else {
      rows = r.salesByProduct.length;
      csv = toCsv(r.salesByProduct.map((c) => ({ product: c.product, units: c.units, sales: cedi(c.sales), cogs: cedi(c.cogs), grossProfit: cedi(c.grossProfit) })), ["product", "units", "sales", "cogs", "grossProfit"].map((k) => ({ key: k, label: k })));
    }
  }

  await audit(actor, "export.csv", "Export", type, { metadata: { filters: sp, rows } });
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ipay-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
