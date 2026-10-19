import "server-only";
import type { Permission } from "@/lib/permissions";
import { requirePermission, type Actor } from "./auth/actor";
import { getActor } from "./auth/session";
import { AppError, toActionError, type ActionResult } from "./errors";

/** Run a server action body, converting thrown errors into a safe ActionResult. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (err) {
    // next/navigation redirect() throws a control-flow error that must propagate.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
    return toActionError(err);
  }
}

export async function actorOrThrow(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  return actor;
}

export async function staffOrThrow(permission: Permission): Promise<Actor> {
  const actor = await actorOrThrow();
  requirePermission(actor, permission);
  return actor;
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
