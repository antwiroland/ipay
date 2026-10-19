import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/ui/primitives";
import { requireStaffPage } from "@/server/auth/session";
import { isSandboxMode } from "@/server/payments";
import { getSettings } from "@/server/services/settings";
import { Alert } from "@/components/ui/primitives";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireStaffPage("settings.manage", "/admin/settings");
  const s = await getSettings();
  const integrations = [
    ["Payments", process.env.PAYMENT_PROVIDER === "paystack" ? (process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_") ? "Paystack (live)" : "Paystack (test)") : "Development sandbox"],
    ["Email", process.env.RESEND_API_KEY ? "Resend" : "Not configured (console in development)"],
    ["SMS", process.env.HUBTEL_SMS_CLIENT_ID ? "Hubtel SMS" : "Not configured (console in development)"],
    ["Image storage", process.env.CLOUDINARY_CLOUD_NAME ? "Cloudinary" : "Local disk (development only)"],
    ["Cron", process.env.CRON_SECRET ? "Configured" : "CRON_SECRET missing"],
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      {isSandboxMode() && <Alert tone="warning" title="Payments are in sandbox mode">No real money moves. Configure Paystack credentials before launch.</Alert>}
      <SettingsForm
        initial={{
          productsMenuLabel: s.productsMenuLabel,
          takeAndPayEnabled: s.purchaseModels.take_and_pay.enabled,
          paySmallSmallEnabled: s.purchaseModels.pay_small_small.enabled,
          takeAndPaySummary: s.purchaseModels.take_and_pay.summary,
          paySmallSmallSummary: s.purchaseModels.pay_small_small.summary,
          reminderDaysBefore: s.reminderDaysBefore,
          pendingPaymentTtlMinutes: s.pendingPaymentTtlMinutes,
          requireStaffMfa: s.requireStaffMfa,
          supportPhone: s.supportPhone,
          supportWhatsapp: s.supportWhatsapp,
          supportEmail: s.supportEmail,
          storeAddress: s.storeAddress,
        }}
      />
      <div className="rounded-[14px] border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Integrations (from environment)</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {integrations.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}
