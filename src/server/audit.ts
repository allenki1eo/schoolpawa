import "server-only";
import { db, schema, type Tx } from "@/db/client";

export type ActorType = "admin" | "student" | "guardian" | "system";

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Never put personal data (phone numbers, nicknames) in meta — ids and counts only. */
  meta?: Record<string, unknown>;
}

/** Append to the audit log (Cybercrimes Act / PDPA accountability). */
export async function audit(entry: AuditEntry, tx?: Tx): Promise<void> {
  await (tx ?? db).insert(schema.auditLog).values({
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    meta: entry.meta,
  });
}
