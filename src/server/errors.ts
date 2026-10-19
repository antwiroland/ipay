export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "ACTIVE_ORDER_EXISTS"
  | "OUT_OF_STOCK"
  | "NOT_ELIGIBLE"
  | "INVALID_STATE"
  | "RATE_LIMITED"
  | "PAYMENT_PROVIDER"
  | "MFA_REQUIRED";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ACTIVE_ORDER_MESSAGE =
  "You currently have an active installment plan. Complete your outstanding balance before applying for another device.";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ErrorCode | "INTERNAL"; error: string; fieldErrors?: Record<string, string[]> };

/** Convert any thrown error into a safe ActionResult (never leaks internals). */
export function toActionError(err: unknown): Extract<ActionResult, { ok: false }> {
  if (err instanceof AppError) {
    return { ok: false, code: err.code, error: err.message, fieldErrors: err.details?.fieldErrors as never };
  }
  if (err && typeof err === "object" && "name" in err && err.name === "ValidationError" && "errors" in err) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries((err as { errors: Record<string, { message: string }> }).errors)) {
      fieldErrors[k] = [v.message];
    }
    return { ok: false, code: "VALIDATION", error: "Please correct the highlighted fields.", fieldErrors };
  }
  console.error("[unexpected]", err);
  return { ok: false, code: "INTERNAL", error: "Something went wrong. Please try again." };
}

export function httpStatusFor(code: ErrorCode | "INTERNAL"): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
    case "MFA_REQUIRED":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "CONFLICT":
    case "ACTIVE_ORDER_EXISTS":
    case "OUT_OF_STOCK":
    case "INVALID_STATE":
    case "NOT_ELIGIBLE":
      return 409;
    case "PAYMENT_PROVIDER":
      return 502;
    default:
      return 500;
  }
}
