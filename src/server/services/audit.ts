import type { ClientSession } from "mongoose";
import { AuditLog } from "@/models";
import { type Actor, isSystem } from "../auth/actor";

export async function audit(
  actor: Actor | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  opts: { reason?: string | null; metadata?: Record<string, unknown>; session?: ClientSession } = {},
) {
  await AuditLog.create(
    [
      {
        actorId: actor && !isSystem(actor) ? actor.userId : null,
        actorRole: actor?.role ?? null,
        action,
        resourceType,
        resourceId,
        reason: opts.reason ?? null,
        metadata: opts.metadata ?? null,
        ip: actor?.ip ?? null,
        timestamp: new Date(),
      },
    ],
    { session: opts.session },
  );
}
