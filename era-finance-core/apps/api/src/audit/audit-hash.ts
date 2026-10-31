import { createHash } from "crypto";

export type AuditHashPayload = {
  organizationId: string | null;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  changes: unknown;
  clientIp: string | null;
  userAgent: string | null;
  createdAt: Date;
  prevHash?: string | null;
};

/** Postgres jsonb does not keep object key order. Sort so a row hashes the same after it is read back. */
function sortAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortAuditValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortAuditValue((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function canonicalAuditJsonString(p: AuditHashPayload): string {
  return JSON.stringify({
    organizationId: p.organizationId,
    userId: p.userId,
    entityType: p.entityType,
    entityId: p.entityId,
    action: p.action,
    oldValues: sortAuditValue(p.oldValues),
    newValues: sortAuditValue(p.newValues),
    changes: sortAuditValue(p.changes),
    clientIp: p.clientIp,
    userAgent: p.userAgent,
    createdAt: p.createdAt.toISOString(),
    prevHash: p.prevHash ?? null,
  });
}

export function computeAuditHash(p: AuditHashPayload, secret: string): string {
  return createHash("sha256")
    .update(canonicalAuditJsonString(p) + secret, "utf8")
    .digest("hex");
}

export function verifyAuditHash(
  p: AuditHashPayload,
  secret: string,
  hash: string | null | undefined,
): boolean {
  if (!hash) {
    return false;
  }
  return computeAuditHash(p, secret) === hash;
}

export function verifyAuditHashLegacy(
  p: Omit<AuditHashPayload, "prevHash">,
  secret: string,
  hash: string | null | undefined,
): boolean {
  if (!hash) return false;
  const legacyPayload = { ...p };
  return (
    createHash("sha256")
      .update(
        JSON.stringify({
          organizationId: legacyPayload.organizationId,
          userId: legacyPayload.userId,
          entityType: legacyPayload.entityType,
          entityId: legacyPayload.entityId,
          action: legacyPayload.action,
          oldValues: legacyPayload.oldValues,
          newValues: legacyPayload.newValues,
          changes: legacyPayload.changes,
          clientIp: legacyPayload.clientIp,
          userAgent: legacyPayload.userAgent,
          createdAt: legacyPayload.createdAt.toISOString(),
        }) + secret,
        "utf8",
      )
      .digest("hex") === hash
  );
}
