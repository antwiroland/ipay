import type { Metadata } from "next";
import { AdminSidebar, type AdminNavItem } from "@/components/admin/admin-sidebar";
import { hasPermission, ROLE_LABEL, type Permission } from "@/lib/permissions";
import { Order } from "@/models";
import { requireStaffPage } from "@/server/auth/session";
import { isSandboxMode } from "@/server/payments";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · iPay Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaffPage("admin.access", "/admin", { enforceMfaPolicy: false });
  const [settings, pendingApps] = await Promise.all([getSettings(), Order.countDocuments({ orderStatus: { $in: ["submitted", "under_review"] } })]);
  const all: (AdminNavItem & { perm: Permission })[] = [
    { href: "/admin", label: "Overview", icon: "overview", perm: "admin.access" },
    { href: "/admin/customers", label: "Customers", icon: "customers", perm: "customers.view" },
    { href: "/admin/products", label: settings.productsMenuLabel, icon: "products", perm: "products.manage" },
    { href: "/admin/orders", label: "Orders", icon: "orders", perm: "orders.view", badge: pendingApps },
    { href: "/admin/plans", label: "Installment Plans", icon: "plans", perm: "plans.manage" },
    { href: "/admin/payments", label: "Payments", icon: "payments", perm: "payments.view" },
    { href: "/admin/installments", label: "Repayment Tracking", icon: "installments", perm: "installments.view" },
    { href: "/admin/promotions", label: "Promotions & Banners", icon: "promotions", perm: "promotions.manage" },
    { href: "/admin/notifications", label: "Notifications", icon: "notifications", perm: "customers.view" },
    { href: "/admin/reports", label: "Reports & Analytics", icon: "reports", perm: "reports.view" },
    { href: "/admin/staff", label: "Staff & Roles", icon: "staff", perm: "staff.manage" },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: "audit", perm: "audit.view" },
    { href: "/admin/settings", label: "Settings", icon: "settings", perm: "settings.manage" },
    { href: "/admin/security", label: "My security", icon: "security", perm: "admin.access" },
  ];
  const items = all.filter((i) => hasPermission(actor.role, i.perm)).map(({ href, label, icon, badge }) => ({ href, label, icon, badge }));
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <AdminSidebar items={items} name={actor.name} role={ROLE_LABEL[actor.role]} sandbox={isSandboxMode()} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
