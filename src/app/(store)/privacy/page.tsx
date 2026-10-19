import type { Metadata } from "next";
import { LegalPage } from "@/components/store/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="19 October 2026"
      sections={[
        { h: "What we collect", p: ["Account details (name, email, phone), order and payment records, and — for plans that require it — limited identity verification data: the ID type, the last four characters of the ID number, a one-way keyed fingerprint of the number used to prevent duplicate accounts, and your date of birth. We do not store copies of your ID or your card or Mobile Money PIN."] },
        { h: "Why we use it", p: ["To provide your account and installment plan, process and confirm payments, send you service messages (confirmations, reminders), prevent fraud, meet legal obligations and — only with your consent — send promotions."] },
        { h: "Who we share it with", p: ["Our payment provider (to process payments), messaging providers (to deliver SMS and email), and hosting providers, each under appropriate agreements. We never share your account or balance with unrelated third parties."] },
        { h: "How long we keep it", p: ["Financial records are kept for the period required by Ghanaian law. Marketing preferences can be changed at any time from your profile."] },
        { h: "Your rights", p: ["Under the Data Protection Act, 2012 (Act 843) you may request access to, correction of, or deletion of your personal data, subject to legal retention requirements. Contact our support team to make a request."] },
        { h: "Security", p: ["Passwords are hashed, sessions are protected, staff access is role-restricted and audited, and payments are verified directly with our provider."] },
      ]}
    />
  );
}
