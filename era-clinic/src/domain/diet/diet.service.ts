import { prisma } from "@/lib/prisma";
import { bakuDayBounds } from "@/lib/baku-day";

export function localizedDietTitle(
  row: { titleAz: string; titleRu: string; titleEn: string },
  locale = "en",
) {
  if (locale === "az") return row.titleAz;
  if (locale === "ru") return row.titleRu;
  return row.titleEn;
}

export async function listDietTables(includeInactive = false) {
  const rows = await prisma.dietTable.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    titleAz: r.titleAz,
    titleRu: r.titleRu,
    titleEn: r.titleEn,
    description: r.description,
    isActive: r.isActive,
  }));
}

export async function createDietTable(input: {
  organizationId: string;
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  description?: string | null;
}) {
  return prisma.dietTable.create({
    data: {
      organizationId: input.organizationId,
      code: input.code.trim().toUpperCase(),
      titleAz: input.titleAz,
      titleRu: input.titleRu,
      titleEn: input.titleEn,
      description: input.description ?? null,
    },
  });
}

export async function patchDietTable(
  id: string,
  patch: Partial<{
    titleAz: string;
    titleRu: string;
    titleEn: string;
    description: string | null;
    isActive: boolean;
  }>,
) {
  return prisma.dietTable.update({ where: { id }, data: patch });
}

export async function assignDiet(input: {
  organizationId: string;
  dietTableId: string;
  clinicalEpisodeId?: string | null;
  admissionId?: string | null;
  assignedFrom: string;
  assignedTo?: string | null;
  assignedByPractitionerId?: string | null;
  notes?: string | null;
}) {
  if (!input.clinicalEpisodeId && !input.admissionId) {
    throw new Error("EPISODE_OR_ADMISSION_REQUIRED");
  }
  return prisma.dietAssignment.create({
    data: {
      organizationId: input.organizationId,
      dietTableId: input.dietTableId,
      clinicalEpisodeId: input.clinicalEpisodeId ?? null,
      admissionId: input.admissionId ?? null,
      assignedFrom: new Date(`${input.assignedFrom}T00:00:00.000Z`),
      assignedTo: input.assignedTo ? new Date(`${input.assignedTo}T00:00:00.000Z`) : null,
      assignedByPractitionerId: input.assignedByPractitionerId ?? null,
      notes: input.notes ?? null,
    },
    include: { dietTable: true },
  });
}

export async function listDietAssignmentsForScope(scope: {
  clinicalEpisodeId?: string;
  admissionId?: string;
}) {
  const where =
    scope.clinicalEpisodeId != null
      ? { clinicalEpisodeId: scope.clinicalEpisodeId }
      : scope.admissionId != null
        ? { admissionId: scope.admissionId }
        : null;
  if (!where) return [];
  const rows = await prisma.dietAssignment.findMany({
    where,
    include: { dietTable: true },
    orderBy: { assignedFrom: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    dietTableId: r.dietTableId,
    dietCode: r.dietTable.code,
    dietTitleAz: r.dietTable.titleAz,
    assignedFrom: r.assignedFrom.toISOString().slice(0, 10),
    assignedTo: r.assignedTo?.toISOString().slice(0, 10) ?? null,
    notes: r.notes,
  }));
}

export async function buildPortionListForDay(dateYmd: string, locale = "en") {
  const { start, end } = bakuDayBounds(dateYmd);
  const assignments = await prisma.dietAssignment.findMany({
    where: {
      assignedFrom: { lte: end },
      OR: [{ assignedTo: null }, { assignedTo: { gte: start } }],
    },
    include: {
      dietTable: true,
      clinicalEpisode: {
        select: {
          id: true,
          roomNumber: true,
          patientRef: { select: { fullName: true, refCode: true } },
        },
      },
      admission: {
        select: {
          id: true,
          caseNumber: true,
          patient: { select: { fullName: true, refCode: true } },
        },
      },
    },
    orderBy: [{ dietTable: { code: "asc" } }, { assignedFrom: "asc" }],
  });

  const byTable = new Map<
    string,
    {
      dietCode: string;
      dietTitle: string;
      rows: Array<{ patientName: string; refCode: string; roomOrCase: string | null }>;
    }
  >();

  for (const row of assignments) {
    const key = row.dietTableId;
    if (!byTable.has(key)) {
      byTable.set(key, {
        dietCode: row.dietTable.code,
        dietTitle: localizedDietTitle(row.dietTable, locale),
        rows: [],
      });
    }
    const bucket = byTable.get(key)!;
    if (row.clinicalEpisode?.patientRef) {
      bucket.rows.push({
        patientName: row.clinicalEpisode.patientRef.fullName,
        refCode: row.clinicalEpisode.patientRef.refCode,
        roomOrCase: row.clinicalEpisode.roomNumber,
      });
    } else if (row.admission?.patient) {
      bucket.rows.push({
        patientName: row.admission.patient.fullName,
        refCode: row.admission.patient.refCode,
        roomOrCase: row.admission.caseNumber,
      });
    }
  }

  return {
    date: dateYmd,
    tables: [...byTable.values()],
    totalAssignments: assignments.length,
  };
}