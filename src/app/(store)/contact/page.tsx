import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { ContactForm } from "@/components/store/contact-form";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Contact us" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const s = await getSettings();
  const items = [
    { icon: Phone, t: "Call us", d: s.supportPhone },
    { icon: MessageCircle, t: "WhatsApp", d: s.supportWhatsapp },
    { icon: Mail, t: "Email", d: s.supportEmail },
    { icon: MapPin, t: "Visit", d: s.storeAddress },
    { icon: Clock, t: "Hours", d: "Mon–Sat, 8am–7pm" },
  ];
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-12 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:px-8">
      <div>
        <h1 className="text-[36px] font-semibold tracking-tight">Contact us</h1>
        <p className="mt-2 text-[15px] text-muted">Questions about a plan, a payment or a device? Our team usually replies within one business day.</p>
        <ul className="mt-8 space-y-4">
          {items.map(({ icon: Icon, t, d }) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-10 place-items-center rounded-[12px] bg-accent-soft text-accent"><Icon className="size-4" /></span>
              <span>
                <span className="block text-sm font-medium">{t}</span>
                <span className="block text-sm text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
