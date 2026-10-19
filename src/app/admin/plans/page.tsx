import { Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatGHS } from "@/lib/money";
import { PURCHASE_MODEL_LABEL } from "@/lib/pricing";
import { Order, PaymentPlan } from "@/models";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "Installment plans" };

export default async function PlansPage() {
  await requireStaffPage("plans.manage", "/admin/plans");
  const [plans, usage] = await Promise.all([
    PaymentPlan.find().sort({ sortOrder: 1 }).lean(),
    Order.aggregate([{ $group: { _id: "$planId", n: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } }]),
  ]);
  return (
    <div>
      <PageHeader title="Installment plans" description="Plan templates. Changing a plan never alters existing customer contracts." actions={<Button asChild><Link href="/admin/plans/new"><Plus /> New plan</Link></Button>} />
      <Table>
        <THead><tr><TH>Plan</TH><TH>Model</TH><TH>Deposit</TH><TH>Schedule</TH><TH>Charges</TH><TH>Rules</TH><TH>Terms</TH><TH className="text-right">Orders</TH><TH>Status</TH></tr></THead>
        <TBody>
          {plans.map((p) => {
            const u = usage.find((x) => x._id?.equals(p._id));
            return (
              <TR key={p._id.toString()}>
                <TD><Link href={`/admin/plans/${p._id}`} className="font-medium text-accent hover:underline">{p.name}</Link><p className="text-[12px] text-muted">{p.code}</p></TD>
                <TD>{PURCHASE_MODEL_LABEL[p.purchaseModel]}</TD>
                <TD className="tabular">{p.depositType === "percentage" ? `${p.depositValue / 100}%` : formatGHS(p.depositValue)}</TD>
                <TD>{p.numberOfInstallments} × {p.frequency}</TD>
                <TD className="tabular">{p.markupBps ? `${p.markupBps / 100}%` : "—"}{p.fees.length ? ` + ${p.fees.length} fee(s)` : ""}</TD>
                <TD className="text-[12.5px] text-muted">{[p.eligibility.requiresVerification && "ID", p.eligibility.requiresApproval && "approval", p.allowPartialPayments && "partial", p.allowAdditionalPayments && "extra"].filter(Boolean).join(" · ")}</TD>
                <TD>v{p.termsVersion}</TD>
                <TD className="tabular text-right">{u?.n ?? 0} <span className="text-muted">({u?.active ?? 0} active)</span></TD>
                <TD>{p.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="grey">Inactive</Badge>}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
