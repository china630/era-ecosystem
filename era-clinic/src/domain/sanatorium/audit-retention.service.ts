import { prisma } from "@/lib/prisma";

/** Hot window for clinic SatelliteAuditLog (months). Matches product decision. */
export const CLINIC_AUDIT_HOT_MONTHS = 24;

/**
 * Move SatelliteAuditLog rows older than hotMonths into SatelliteAuditLogArchive,
 * then delete from the hot table. Safe to call repeatedly (idempotent per id).
 * Requires migration that creates satellite_audit_log_archives.
 */
export async function archiveClinicAuditOlderThan(
  hotMonths = CLINIC_AUDIT_HOT_MONTHS,
  batchSize = 500,
): Promise<{ archived: number }> {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - hotMonths);

  let archived = 0;
  for (;;) {
    const rows = await prisma.satelliteAuditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });
    if (rows.length === 0) break;

    await prisma.$transaction(async (tx) => {
      await tx.satelliteAuditLogArchive.createMany({
        data: rows.map((r) => ({
          id: r.id,
          organizationId: r.organizationId,
          userId: r.userId,
          entityType: r.entityType,
          entityId: r.entityId,
          action: r.action,
          changesJson: r.changesJson,
          ipAddress: r.ipAddress,
          integrityHash: r.integrityHash,
          createdAt: r.createdAt,
          archivedAt: new Date(),
        })),
        skipDuplicates: true,
      });
      await tx.satelliteAuditLog.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
    });
    archived += rows.length;
    if (rows.length < batchSize) break;
  }
  return { archived };
}
