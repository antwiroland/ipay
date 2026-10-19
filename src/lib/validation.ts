import { z } from "zod";

export function normalizeGhanaPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let local: string | null = null;
  if (/^\+233\d{9}$/.test(digits)) local = digits.slice(4);
  else if (/^233\d{9}$/.test(digits)) local = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) local = digits.slice(1);
  if (!local || !/^[235]\d{8}$/.test(local)) return null;
  return `+233${local}`;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeGhanaPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Ghana phone number, e.g. 024 123 4567" });
      return z.NEVER;
    }
    return n;
  });

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254));

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Password is too long")
  .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), "Include at least one letter and one number");

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: "You must accept the terms and privacy policy" }),
    marketingConsent: z.boolean().optional().default(false),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** Cedi string → pesewas. "6,600" → 660000 */
export const cediAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const raw = String(v).replace(/[,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return z.NEVER;
    }
    const [w, f = ""] = raw.split(".");
    return Number(w) * 100 + Number(f.padEnd(2, "0"));
  });

/** Only same-site relative paths, to prevent open redirects. */
export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const u = new URL(value, "http://local");
    if (u.host !== "local") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Banner destinations: internal paths, or https URLs on an allow-list of hosts. */
export function isSafeDestination(value: string): boolean {
  if (value.startsWith("/") && safeInternalPath(value, "") === value) return true;
  try {
    const u = new URL(value);
    const allowed = (process.env.ALLOWED_PROMO_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
    return u.protocol === "https:" && allowed.includes(u.hostname);
  } catch {
    return false;
  }
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
