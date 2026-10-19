import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { getSettings } from "@/server/services/settings";
import { NewsletterForm } from "./newsletter-form";

export async function SiteFooter() {
  const s = await getSettings().catch(() => null);
  const year = new Date().getFullYear();
  return (
    <footer className="no-print mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Your iPhone. Your plan. Your pace. Flexible installment plans for customers across Ghana, with every payment tracked transparently.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2"><Phone className="size-4" /> {s?.supportPhone}</li>
            <li className="flex items-center gap-2"><MessageCircle className="size-4" /> WhatsApp {s?.supportWhatsapp}</li>
            <li className="flex items-center gap-2"><Mail className="size-4" /> {s?.supportEmail}</li>
            <li className="flex items-center gap-2"><MapPin className="size-4" /> {s?.storeAddress}</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Shop</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link className="hover:text-foreground" href="/shop">All iPhones</Link></li>
            <li><Link className="hover:text-foreground" href="/shop?condition=brand_new">Brand new</Link></li>
            <li><Link className="hover:text-foreground" href="/shop?condition=uk_used">UK used</Link></li>
            <li><Link className="hover:text-foreground" href="/promotions">Promotions</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link className="hover:text-foreground" href="/how-it-works">How it works</Link></li>
            <li><Link className="hover:text-foreground" href="/faq">FAQ</Link></li>
            <li><Link className="hover:text-foreground" href="/contact">Contact</Link></li>
            <li><Link className="hover:text-foreground" href="/terms">Terms</Link></li>
            <li><Link className="hover:text-foreground" href="/privacy">Privacy policy</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Offers in your inbox</h3>
          <p className="mt-4 text-sm text-muted">New arrivals and promotions. No spam — unsubscribe anytime.</p>
          <NewsletterForm />
          <div className="mt-6 flex gap-4 text-sm text-muted">
            {s?.socialLinks?.instagram && <a href={s.socialLinks.instagram} rel="noopener noreferrer" target="_blank">Instagram</a>}
            {s?.socialLinks?.tiktok && <a href={s.socialLinks.tiktok} rel="noopener noreferrer" target="_blank">TikTok</a>}
            {s?.socialLinks?.x && <a href={s.socialLinks.x} rel="noopener noreferrer" target="_blank">X</a>}
            {s?.socialLinks?.facebook && <a href={s.socialLinks.facebook} rel="noopener noreferrer" target="_blank">Facebook</a>}
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[12.5px] text-subtle sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>© {year} iPay Ghana. All rights reserved.</p>
          <p>iPhone is a trademark of Apple Inc. iPay Ghana is an independent retailer and is not affiliated with Apple.</p>
        </div>
      </div>
    </footer>
  );
}
