import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

export async function findPractitionerIdByUserId(userId: string) {
  return prisma.practitioner.findFirst({
    where: { userId },
    select: { id: true },
  });
}

export async function listProcedureOrdersForDay(where: Prisma.ProcedureOrderWhereInput) {
  return prisma.procedureOrder.findMany({
    where,
    include: {
      patientRef: true,
      clinicalEpisode: { select: { roomNumber: true } },
      resource: { select: { id: true, code: true, name: true } },
      allocations: {
        where: { role: "STAFF" },
        select: { practitionerId: true, role: true },
      },
      sites: {
        orderBy: { sortOrder: "asc" },
        select: {
          laterality: true,
          site: {
            select: { titleAz: true, titleRu: true, titleEn: true, titleLa: true },
          },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });
}

export async function findPhysioListItemsByIds(listIds: string[]) {
  if (listIds.length === 0) return [];
  return prisma.physioListItem.findMany({
    where: { id: { in: listIds } },
    select: { id: true, titleAz: true, titleRu: true, titleEn: true },
  });
}

export async function findBodyPartLookupsByCodes(bodyCodes: string[]) {
  if (bodyCodes.length === 0) return [];
  return prisma.clinicLookup.findMany({
    where: { kind: "BODY_PART", code: { in: bodyCodes } },
    select: { code: true, name: true },
  });
}

export async function findOpenPackageBalance(input: {
  procedureCode: string;
  patientRefId?: string;
  reservationId?: string;
}) {
  return prisma.programProcedureBalance.findFirst({
    where: {
      procedureCode: input.procedureCode,
      instance: input.patientRefId
        ? { episode: { patientRefId: input.patientRefId, status: "OPEN" } }
        : { reservationId: input.reservationId! },
    },
  });
}

export async function findProcedureTypeByCode(code: string) {
  return prisma.procedureType.findFirst({
    where: { code },
    select: { id: true, openAttendance: true, durationMin: true },
  });
}

export async function createManualProcedureOrder(data: {
  patientRefId: string;
  clinicalEpisodeId?: string;
  procedureTypeId?: string;
  procedureCode: string;
  procedureName: string;
  scheduledAt: Date;
  patientOrigin: "WALK_IN" | "IN_HOUSE";
  reservationId?: string;
  amountNet: number;
  schedulingMode: "OPEN" | "FIXED";
}) {
  return prisma.procedureOrder.create({
    data: {
      organizationId: requestOrganizationId(),
      patientRefId: data.patientRefId,
      clinicalEpisodeId: data.clinicalEpisodeId,
      procedureTypeId: data.procedureTypeId,
      procedureCode: data.procedureCode,
      procedureName: data.procedureName,
      scheduledAt: data.scheduledAt,
      patientOrigin: data.patientOrigin,
      reservationId: data.reservationId,
      amountNet: data.amountNet,
      inPackage: false,
      bonusEligible: data.amountNet > 0,
      manuallyAdjusted: true,
      schedulingMode: data.schedulingMode,
      status: "PROPOSED",
    },
    include: { patientRef: true },
  });
}

export async function deleteProcedureOrderById(id: string) {
  return prisma.procedureOrder.delete({ where: { id } });
}

export async function getProcedureOrderWithPatient(id: string) {
  return prisma.procedureOrder.findUnique({
    where: { id },
    include: { patientRef: true },
  });
}

export async function findProposedProcedureOrdersByIds(orderIds: string[]) {
  return prisma.procedureOrder.findMany({
    where: { id: { in: orderIds }, status: "PROPOSED" },
    select: {
      id: true,
      patientRefId: true,
      sequenceIndex: true,
      clinicalEpisodeId: true,
      schedulingMode: true,
    },
  });
}

export async function countEpisodesAssignedToPractitioner(
  episodeIds: string[],
  episodeWhere: Prisma.ClinicalEpisodeWhereInput,
) {
  return prisma.clinicalEpisode.count({
    where: {
      id: { in: episodeIds },
      ...episodeWhere,
    },
  });
}

export async function listProposedProcedureOrdersForPatient(patientRefId: string) {
  return prisma.procedureOrder.findMany({
    where: { patientRefId, status: "PROPOSED" },
    select: { id: true, sequenceIndex: true },
    orderBy: [{ sequenceIndex: "asc" }, { scheduledAt: "asc" }],
  });
}

export async function getProcedureOrderSummary(id: string) {
  return prisma.procedureOrder.findUnique({ where: { id } });
}

export async function getClinicalEpisodeById(id: string) {
  return prisma.clinicalEpisode.findUnique({
    where: { id },
  });
}

export async function listBulkCancelProcedureTargets(
  where: Prisma.ProcedureOrderWhereInput,
) {
  return prisma.procedureOrder.findMany({
    where,
    select: {
      id: true,
      status: true,
      procedureCode: true,
      bodyPart: true,
      sequenceIndex: true,
    },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function cancelProposedProcedureOrder(
  id: string,
  input: { cancelledByUserId: string; reason: string },
) {
  return prisma.procedureOrder.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByUserId: input.cancelledByUserId,
      cancelReason: input.reason,
    },
  });
}

export async function findProcedureTypeFullByCode(code: string) {
  return prisma.procedureType.findFirst({
    where: { code },
  });
}

export async function createReplacementProcedureOrder(data: {
  patientRefId: string;
  clinicalEpisodeId?: string;
  procedureType: {
    id: string;
    code: string;
    name: string;
    openAttendance: boolean | null;
    bodyPart: string | null;
  };
  scheduledAt: Date;
  endsAt: Date;
  sequenceIndex: number;
  bodyPart?: string;
  reservationId?: string;
}) {
  const pt = data.procedureType;
  return prisma.procedureOrder.create({
    data: {
      organizationId: requestOrganizationId(),
      patientRefId: data.patientRefId,
      clinicalEpisodeId: data.clinicalEpisodeId,
      procedureCode: pt.code,
      procedureName: pt.name,
      procedureTypeId: pt.id,
      scheduledAt: data.scheduledAt,
      endsAt: data.endsAt,
      sequenceIndex: data.sequenceIndex,
      bodyPart: data.bodyPart ?? pt.bodyPart ?? undefined,
      reservationId: data.reservationId,
      schedulingMode: pt.openAttendance === true ? "OPEN" : "FIXED",
      status: "PROPOSED",
    },
  });
}

export async function findProcedureOrdersForTicketIssue(ids: string[]) {
  return prisma.procedureOrder.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, patientRefId: true },
  });
}

export async function findUnsettledLabOrdersForTicketIssue(ids: string[]) {
  return prisma.labOrder.findMany({
    where: {
      id: { in: ids },
      amountNet: { gt: 0 },
      settledAt: null,
      inPackage: false,
    },
    select: { id: true, patientRefId: true },
  });
}

export async function findUnsettledVisitOrdersForTicketIssue(ids: string[]) {
  return prisma.visit.findMany({
    where: {
      id: { in: ids },
      amountNet: { gt: 0 },
      settledAt: null,
      NOT: { serviceLines: { some: { inPackage: true } } },
    },
    select: { id: true, patientRefId: true },
  });
}

export async function findScheduledProcedureByAccessCode(
  organizationId: string,
  accessCode: string,
) {
  return prisma.procedureOrder.findFirst({
    where: {
      organizationId,
      accessCode,
      status: "SCHEDULED",
    },
    select: { id: true },
  });
}
