import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";

export type EpisodeAuditCtx = { userId?: string | null; request?: Request };

export async function recordEpisodeAudit(
  ctx: EpisodeAuditCtx,
  episodeId: string,
  action: string,
  changes?: Record<string, unknown>,
): Promise<void> {
  await recordClinicAudit(ctx, "ClinicalEpisode", episodeId, action, {
    ...changes,
    episodeId,
  });
}

type EpisodeJournalField = { key: string; from: string | null; to: string | null };

export async function listEpisodeJournal(episodeId: string, limit = 100) {
  const rows = await prisma.satelliteAuditLog.findMany({
    where: { entityType: "ClinicalEpisode", entityId: episodeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => {
    const changes = JSON.parse(row.changesJson || "{}") as Record<string, unknown> & {
      summary?: string;
      fields?: EpisodeJournalField[];
    };
    const summary =
      typeof changes.summary === "string" ? changes.summary : row.action;
    const fields = Array.isArray(changes.fields) ? changes.fields : [];
    return {
      id: row.id,
      action: row.action,
      createdAt: row.createdAt,
      userId: row.userId,
      summary,
      fields,
      changes,
    };
  });
}