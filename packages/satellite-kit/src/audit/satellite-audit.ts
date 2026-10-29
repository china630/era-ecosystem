import { createHash } from "crypto";

/** Substring fragments (lowercased) — ADR era-mutation-audit-standard redaction families. */
const PII_KEY_FRAGMENTS = [
  "password",
  "passwordhash",
  "passpor",
  "fin",
  "phone",
  "email",
  "documentnumber",
  "nationalid",
  "token",
  "secret",
  "authorization",
  "apikey",
  "accesstoken",
  "refreshtoken",
  "cardpan",
  "cardnumber",
  "cvv",
  "iban",
  "accountnumber",
  "pin",
] as const;

/** True when a JSON key should be redacted in audit payloads (case-insensitive substring). */
export function isAuditPiiKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[_-]/g, "");
  return PII_KEY_FRAGMENTS.some((p) => lower.includes(p));
}

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
      out[k] = isAuditPiiKey(k) ? "[redacted]" : redactAuditChanges(v, depth + 1);
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

/** Optional workforce correlation fields for satellite ops audit. */
export type WorkforceAuditContext = {
  cpEmploymentId?: string | null;
  globalPersonId?: string | null;
};

export function stampWorkforceAuditContext(
  session: WorkforceAuditContext | null | undefined,
  changes?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!session?.cpEmploymentId && !session?.globalPersonId) {
    return changes ?? undefined;
  }
  return {
    ...(changes ?? {}),
    ...(session?.cpEmploymentId
      ? { cpEmploymentId: session.cpEmploymentId }
      : {}),
    ...(session?.globalPersonId
      ? { globalPersonId: session.globalPersonId }
      : {}),
  };
}

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
