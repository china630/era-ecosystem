import { prisma } from "@/lib/prisma";
export {
  COMPLAINT_REQUIRED,
  DIAGNOSIS_REQUIRED,
  NAFTA_LANE_GATE,
  laneDenied,
  normalizeLaneGate,
  type LaneDenial,
  type LaneFacts,
  type LaneGatePolicy,
  type LaneId,
  type LaneSnapshot,
} from "@/domain/sanatorium/lane-gate-policy";
import type { LaneDenial, LaneId } from "@/domain/sanatorium/lane-gate-policy";
import { laneDenied, normalizeLaneGate } from "@/domain/sanatorium/lane-gate-policy";

export async function loadLaneGate(): Promise<LaneGatePolicy> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  return normalizeLaneGate(tenant?.laneGateJson ?? null);
}

export async function procedureLaneDenial(episodeId: string): Promise<LaneDenial | null> {
  return laneDenial(episodeId, "procedures");
}

export async function laneDenial(episodeId: string, lane: LaneId): Promise<LaneDenial | null> {
  const [policy, episode] = await Promise.all([
    loadLaneGate(),
    prisma.clinicalEpisode.findUnique({
      where: { id: episodeId },
      select: {
        anamnesisText: true,
        _count: { select: { complaints: true, diagnoses: true } },
      },
    }),
  ]);
  if (!episode) return null;
  return laneDenied(policy, lane, {
    anamnesisText: episode.anamnesisText,
    complaintCount: episode._count.complaints,
    diagnosisCount: episode._count.diagnoses,
  });
}
