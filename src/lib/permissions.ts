export const ROLES = ["customer", "support", "sales_officer", "finance_officer", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: Role[] = ["support", "sales_officer", "finance_officer", "admin", "super_admin"];
export const isStaffRole = (r: Role) => STAFF_ROLES.includes(r);

export const PERMISSIONS = [
  "admin.access",
  "customers.view",
  "customers.pii", // see unmasked phone/email/identity
  "customers.notes",
  "customers.suspend",
  "customers.verify",
  "products.manage",
  "plans.manage",
  "orders.view",
  "orders.review", // approve / reject
  "orders.fulfil", // record preparation / collection
  "orders.manage", // cancel, suspend, complete
  "installments.view",
  "payments.view",
  "payments.export",
  "payments.refund",
  "payments.manual", // record offline payment (auditable correction)
  "payments.reconcile",
  "promotions.manage",
  "notifications.manage",
  "reports.view",
  "reports.export",
  "staff.manage",
  "audit.view",
  "settings.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const SUPPORT: Permission[] = [
  "admin.access",
  "customers.view",
  "customers.pii",
  "customers.notes",
  "orders.view",
  "installments.view",
  "payments.view",
];

const SALES: Permission[] = [
  "admin.access",
  "customers.view",
  "customers.notes",
  "customers.verify",
  "products.manage",
  "orders.view",
  "orders.review",
  "orders.fulfil",
  "installments.view",
  "promotions.manage",
  "reports.view",
];

const FINANCE: Permission[] = [
  "admin.access",
  "customers.view",
  "customers.pii",
  "orders.view",
  "installments.view",
  "payments.view",
  "payments.export",
  "payments.refund",
  "payments.manual",
  "payments.reconcile",
  "reports.view",
  "reports.export",
  "audit.view",
];

const ADMIN: Permission[] = PERMISSIONS.filter((p) => p !== "staff.manage");

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: [],
  support: SUPPORT,
  sales_officer: SALES,
  finance_officer: FINANCE,
  admin: ADMIN,
  super_admin: PERMISSIONS,
};

export const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  support: "Customer Support",
  sales_officer: "Sales Officer",
  finance_officer: "Finance Officer",
  admin: "Administrator",
  super_admin: "Super Admin",
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "•••";
  return `${phone.slice(0, 4)}${"•".repeat(phone.length - 6)}${phone.slice(-2)}`;
}
