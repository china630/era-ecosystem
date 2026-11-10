import { prisma } from "@/lib/prisma";
import { ANAMNESIS_REQUIRED } from "@/domain/sanatorium/episode-gates";

export const COMPLAINT_REQUIRED = "COMPLAINT_REQUIRED";
export const DIAGNOSIS_REQUIRED = "DIAGNOSIS_REQUIRED";

export type LaneId = "procedures" | "labs" | "visits";
export type LaneFacts = {
  anamnesis: boolean;
  complaints: boolean;
  diagnoses: boolean;
};
export type LaneGatePolicy = Record<LaneId, LaneFacts>;

export const NAFTA_LANE_GATE: LaneGatePolicy = {
  procedures: { anamnesis: true, complaints: true, diagnoses: true },
  labs: { anamnesis: false, complaints: false, diagnoses: false },
  visits: { anamnesis: false, complaints: false, diagnoses: false },
};

const LANES: LaneId[] = ["procedures", "labs", "visits"];

function fact(raw: unknown, key: keyof LaneFacts, fallback: boolean): boolean {
  if (!raw || typeof raw !== "object") return fallback;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeLaneGate(raw: unknown): LaneGatePolicy {
  const source = typeof raw === "string" ? safeParse(raw) : raw;
  const out = {} as LaneGatePolicy;
  for (const lane of LANES) {
    const row =
      source && typeof source === "object"
        ? (source as Record<string, unknown>)[lane]
        : undefined;
    out[lane] = {
      anamnesis: fact(row, "anamnesis", NAFTA_LANE_GATE[lane].anamnesis),
      complaints: fact(row, "complaints", NAFTA_LANE_GATE[lane].complaints),
      diagnoses: fact(row, "diagnoses", NAFTA_LANE_GATE[lane].diagnoses),
    };
  }
  return out;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export type LaneSnapshot = {
  anamnesisText?: string | null;
  complaintCount: number;
  diagnosisCount: number;
};

export type LaneDenial = {
  message: string;
  code: typeof ANAMNESIS_REQUIRED | typeof COMPLAINT_REQUIRED | typeof DIAGNOSIS_REQUIRED;
};

export function laneDenied(
  policy: LaneGatePolicy,
  lane: LaneId,
  facts: LaneSnapshot,
): LaneDenial | null {
  const need = policy[lane];
  if (need.anamnesis && !facts.anamnesisText?.trim()) {
    return {
      message: "Anamnesis is required before assigning or confirming procedures",
      code: ANAMNESIS_REQUIRED,
    };
  }
  if (need.complaints && facts.complaintCount < 1) {
    return {
      message: "A complaint is required before assigning or confirming procedures",
      code: COMPLAINT_REQUIRED,
    };
  }
  if (need.diagnoses && facts.diagnosisCount < 1) {
    return {
      message: "A diagnosis is required before assigning or confirming procedures",
      code: DIAGNOSIS_REQUIRED,
    };
  }
  return null;
}

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
