import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AdminAuditLogQuery = {
  entityType: string;
  entityId?: string;
  action?: string;
  userId?: string;
  createdAt?: { gte?: Date; lte?: Date };
  limit: number;
};

export async function listAdminSatelliteAuditLogs(opts: AdminAuditLogQuery) {
  const where: Prisma.SatelliteAuditLogWhereInput = {
    entityType: opts.entityType,
    ...(opts.entityId ? { entityId: opts.entityId } : {}),
    ...(opts.action ? { action: opts.action } : {}),
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.createdAt?.gte || opts.createdAt?.lte ? { createdAt: opts.createdAt } : {}),
  };
  return prisma.satelliteAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts.limit,
  });
}
