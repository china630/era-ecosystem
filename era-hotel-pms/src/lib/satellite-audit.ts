import { auditMutation, type SatelliteAuditWriter } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

const writeAudit: SatelliteAuditWriter = async (row) => {
  await prisma.satelliteAuditLog.create({ data: row });
};

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}

export async function recordHotelAudit(
  ctx: { userId?: string | null; request?: Request },
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
): Promise<void> {
  await auditMutation(writeAudit, {
    userId: ctx.userId,
    ipAddress: ctx.request ? clientIp(ctx.request) : null,
  }, entityType, entityId, action, changes);
}

export type AuditListFilters = {
  entityType: string;
  entityId?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
};

export async function listAuditLogs(filters: AuditListFilters) {
  const where: {
    entityType: string;
    entityId?: string;
    action?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { entityType: filters.entityType };

  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.action) where.action = filters.action;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  return prisma.satelliteAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 50,
  });
}
