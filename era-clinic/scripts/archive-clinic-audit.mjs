/**
 * Archive SatelliteAuditLog rows older than CLINIC_AUDIT_HOT_MONTHS (24)
 * into satellite_audit_log_archives. Run via cron / ops:
 *   node era-clinic/scripts/archive-clinic-audit.mjs
 * Requires DATABASE_URL and migration 20261120190000 applied.
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function main() {
  // Dynamic import after path setup — Nest/TS build not required.
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const hotMonths = Number(process.env.CLINIC_AUDIT_HOT_MONTHS || 24);
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - hotMonths);
  let archived = 0;
  const batchSize = 500;
  try {
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
    console.log(
      JSON.stringify({ ok: true, archived, hotMonths, cutoff: cutoff.toISOString() }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
