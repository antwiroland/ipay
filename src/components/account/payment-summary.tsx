import { CalendarClock, History } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatGHS, progressPercent } from "@/lib/money";

export function PaymentSummary({
  orderId,
  total,
  paid,
  outstanding,
  nextAmount,
  nextDate,
  depositPending,
  installmentsDone,
  installmentsTotal,
}: {
  orderId: string;
  total: number;
  paid: number;
  outstanding: number;
  nextAmount: number | null;
  nextDate: string | Date | null;
  depositPending: boolean;
  installmentsDone: number;
  installmentsTotal: number;
}) {
  const pct = progressPercent(paid, total);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="rounded-[20px] bg-foreground p-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-white/60">Outstanding balance</p>
            <p className="tabular mt-1 text-[30px] leading-none font-semibold tracking-tight break-all sm:text-[38px]" data-testid="outstanding-balance">{formatGHS(outstanding)}</p>
          </div>
          <p className="tabular rounded-full bg-white/10 px-2.5 py-1 text-sm font-medium" data-testid="progress-percent">{pct}%</p>
        </div>
        <Progress value={pct} className="mt-6 bg-white/10" label="Payment progress" />
        <dl className="mt-5 grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-white/60">Total purchase price</dt>
            <dd className="tabular mt-0.5 text-[15px] font-semibold">{formatGHS(total)}</dd>
          </div>
          <div>
            <dt className="text-white/60">Confirmed paid</dt>
            <dd className="tabular mt-0.5 text-[15px] font-semibold" data-testid="amount-paid">{formatGHS(paid)}</dd>
          </div>
          <div>
            <dt className="text-white/60">Installments</dt>
            <dd className="tabular mt-0.5 text-[15px] font-semibold">
              {installmentsDone} of {installmentsTotal} paid
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-col justify-between gap-4 rounded-[20px] border border-border bg-surface p-6">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <CalendarClock className="size-4" /> {depositPending ? "Deposit due" : "Upcoming installment"}
          </p>
          {outstanding === 0 ? (
            <p className="mt-2 text-lg font-semibold text-success">All paid — nothing due</p>
          ) : (
            <>
              <p className="tabular mt-2 text-2xl font-semibold">{nextAmount != null ? formatGHS(nextAmount) : "—"}</p>
              <p className="text-[13px] text-muted">{depositPending ? "Pay to start your plan" : nextDate ? `Due ${formatDate(nextDate)}` : ""}</p>
            </>
          )}
          <p className="mt-3 text-[12.5px] text-muted">{installmentsTotal - installmentsDone} installment{installmentsTotal - installmentsDone === 1 ? "" : "s"} remaining</p>
        </div>
        <Link href={`/account/payments?order=${orderId}`} className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
          <History className="size-4" /> View payment history
        </Link>
      </div>
    </div>
  );
}
