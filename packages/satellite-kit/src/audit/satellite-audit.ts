import { createHash } from "crypto";

const PII_KEYS = new Set([
  "password",
  "passwordhash",
  "passpor",
  "fin",
  "phone",
  "email",
  "documentnumber",
  "nationalid",
]);

export type SatelliteAuditInput = {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

export type SatelliteAuditWriter = (row: {
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  changesJson: string;
  ipAddress: string | null;
  integrityHash: string;
}) => Promise<void>;

function isPiiKey(key: string): boolean {
  const lower = key.toLowerCase();
  return [...PII_KEYS].some((p) => lower.includes(p));
}

/** Redact sensitive fields before persisting audit payload. */
export function redactAuditChanges(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 8) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactAuditChanges(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isPiiKey(k) ? "[redacted]" : redactAuditChanges(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function buildAuditChangesJson(changes?: Record<string, unknown> | null): string {
  const redacted = redactAuditChanges(changes ?? {}) as Record<string, unknown>;
  return JSON.stringify(redacted);
}

export function auditIntegrityHash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

/** Persist audit row via injected writer (Prisma per satellite). */
export async function recordSatelliteAudit(
  write: SatelliteAuditWriter,
  input: SatelliteAuditInput,
): Promise<void> {
  const changesJson = buildAuditChangesJson(input.changes ?? undefined);
  const integrityHash = auditIntegrityHash(
    `${input.entityType}|${input.entityId}|${input.action}|${changesJson}`,
  );
  await write({
    userId: input.userId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    changesJson,
    ipAddress: input.ipAddress ?? null,
    integrityHash,
  });
}

export type MutationAuditContext = {
  userId?: string | null;
  ipAddress?: string | null;
};

/** Call after successful mutation in route handlers. */
export async function auditMutation(
  write: SatelliteAuditWriter,
  ctx: MutationAuditContext,
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
): Promise<void> {
  try {
    await recordSatelliteAudit(write, {
      userId: ctx.userId,
      entityType,
      entityId,
      action,
      changes,
      ipAddress: ctx.ipAddress,
    });
  } catch (err) {
    console.error("[satellite-audit] failed to record", err);
  }
}
