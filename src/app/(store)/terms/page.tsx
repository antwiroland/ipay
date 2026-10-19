import type { Metadata } from "next";
import { LegalPage } from "@/components/store/legal-page";

export const metadata: Metadata = { title: "Terms and conditions" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and conditions"
      updated="19 October 2026"
      sections={[
        { h: "1. About these terms", p: ["These terms govern your use of the iPay Ghana website and any installment purchase agreement you enter into with iPay Ghana. Each plan also has its own agreement, which you accept when you apply and which is saved with your order."] },
        { h: "2. Your account", p: ["You must provide accurate information and keep your password secure. You are responsible for activity on your account. You must be 18 or older to apply for an installment plan."] },
        { h: "3. Prices", p: ["Every product shows a cash price and an installment price. The total amount payable for a plan, including any disclosed financing charge or fees, is shown before you apply and fixed in your agreement. Later price changes do not affect existing agreements."] },
        { h: "4. One active plan", p: ["You may hold one active installment plan at a time. You may apply for another device once your current plan is fully paid and completed."] },
        { h: "5. Payments", p: ["Payments are processed by our licensed payment provider. A payment is applied to your balance only after it has been confirmed by the provider. Payments settle your oldest outstanding installment first. Any amount above your outstanding balance is refunded."] },
        { h: "6. Late payments", p: ["Each plan includes a grace period after every due date. We do not charge automatic late fees. If a payment is late we will contact you respectfully to agree a way forward. We will never disclose your account to third parties other than as required by law or with your consent."] },
        { h: "7. Ownership and collection", p: ["The device remains the property of iPay Ghana until the agreed price has been paid in full. Take & Pay devices are released after approval and confirmed deposit. Pay Small-Small devices are released once fully paid. A valid ID matching your account is required at collection."] },
        { h: "8. Cancellation and refunds", p: ["You may cancel online before your deposit is paid. After that, contact support. Refunds are processed back to the original payment method where possible."] },
        { h: "9. Contact", p: ["Questions about these terms? Contact our support team using the details on the Contact page."] },
      ]}
    />
  );
}
