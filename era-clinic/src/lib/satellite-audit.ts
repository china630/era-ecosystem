import { auditMutation, type SatelliteAuditWriter } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

const writeAudit: SatelliteAuditWriter = async (row) => {
  await prisma.satelliteAuditLog.create({ data: row });
};

export function clientIp(
  source: { get(name: string): string | null } | { headers: { get(name: string): string | null } },
): string | null {
  const read = (name: string): string | null =>
    "headers" in source ? source.headers.get(name) : source.get(name);
  const forwarded = read("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return read("x-real-ip");
}

export async function recordClinicAudit(
  ctx: {
    userId?: string | null;
    request?: { get(name: string): string | null } | { headers: { get(name: string): string | null } };
  },
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
): Promise<void> {
  await auditMutation(
    writeAudit,
    {
      userId: ctx.userId,
      ipAddress: ctx.request ? clientIp(ctx.request) : null,
    },
    entityType,
    entityId,
    action,
    changes,
  );
}

export async function listAuditLogs(entityType: string, entityId: string, limit = 50) {
  return prisma.satelliteAuditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
