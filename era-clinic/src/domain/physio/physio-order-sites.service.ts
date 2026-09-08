import type { Prisma, ProcedureSiteApplyMode, ProcedureSiteLaterality } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { PhysioCatalogError } from "./physio-catalog";
import {
  deriveCoarseBodyPart,
  parseApplyMode,
  resolveSiteApplyMode,
  uniqueOrderedIds,
  type ProcedureSiteApplyModeCode,
} from "./physio-order-sites";
import {
  assertLateralityAllowed,
  lateralityBySiteId,
  parseSiteLateralityMap,
  readPhysioFields,
  sanitizePhysioFields,
  type PhysioLateralityCode,
  type PhysioOrderFields,
} from "./physio-order-fields";
import { inferPhysioTypeGate } from "./physio-type-gate";

export const PROCEDURE_PHYSIO_INCLUDE = {
  sites: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      site: {
        select: {
          id: true,
          code: true,
          titleAz: true,
          titleRu: true,
          titleEn: true,
          titleLa: true,
          coarse: true,
          active: true,
          laterality: true,
        },
      },
    },
  },
  procedureType: {
    select: {
      needsSite: true,
      physioOrderFields: true,
      allowedSiteCodes: true,
      code: true,
      name: true,
    },
  },
} as const;

export type PhysioOrderPayload = {
  needsSite: boolean;
  physioOrderFields: string[];
  allowedSiteCodes: string[];
  forceSiteTogether: boolean;
  sitesHintKey: "hydro_jet_safety" | null;
  siteIds: string[];
  siteApplyMode: ProcedureSiteApplyModeCode | null;
  siteLaterality: Record<string, PhysioLateralityCode | null>;
  physioFields: PhysioOrderFields;
  note: string | null;
  bodyPart: string | null;
};

export function toPhysioOrderPayload(order: {
  note: string | null;
  bodyPart: string | null;
  siteApplyMode: ProcedureSiteApplyMode | null;
  physioFields?: unknown;
  procedureType?: {
    needsSite: boolean;
    physioOrderFields?: string[];
    allowedSiteCodes?: string[];
    code?: string;
    name?: string;
  } | null;
  sites: Array<{ siteId: string; laterality?: ProcedureSiteLaterality | null }>;
}): PhysioOrderPayload {
  const gate = inferPhysioTypeGate(
    order.procedureType?.code ?? "",
    order.procedureType?.name ?? "",
  );
  return {
    needsSite: order.procedureType?.needsSite !== false,
    physioOrderFields: order.procedureType?.physioOrderFields ?? [],
    allowedSiteCodes: order.procedureType?.allowedSiteCodes ?? [],
    forceSiteTogether: gate.forceSiteTogether,
    sitesHintKey: gate.sitesHintKey,
    siteIds: order.sites.map((s) => s.siteId),
    siteApplyMode: order.siteApplyMode,
    siteLaterality: lateralityBySiteId(
      order.sites.map((s) => ({ siteId: s.siteId, laterality: s.laterality ?? null })),
    ),
    physioFields: readPhysioFields(order.physioFields),
    note: order.note,
    bodyPart: order.bodyPart,
  };
}

async function assertListItem(
  id: string | null | undefined,
  listKind: "DEVICE_PROGRAM" | "SUBSTANCE",
) {
  if (!id) return;
  const row = await prisma.physioListItem.findFirst({ where: { id } });
  if (!row) throw new PhysioCatalogError(`Unknown ${listKind.toLowerCase()}`, 400);
  if (row.listKind !== listKind) {
    throw new PhysioCatalogError(`List item is not ${listKind}`, 400);
  }
  if (!row.active) {
    throw new PhysioCatalogError(`${listKind} is inactive: ${row.code}`, 409);
  }
}

export async function patchProcedureOrderPhysio(
  orderId: string,
  input: {
    siteIds?: string[];
    siteApplyMode?: string | null;
    siteLaterality?: unknown;
    physioFields?: unknown;
    note?: string | null;
    bodyPart?: string | null;
  },
) {
  const existing = await prisma.procedureOrder.findFirst({
    where: { id: orderId },
    include: PROCEDURE_PHYSIO_INCLUDE,
  });
  if (!existing) throw new PhysioCatalogError("Procedure order not found", 404);
  if (!["PROPOSED", "SCHEDULED"].includes(existing.status)) {
    throw new PhysioCatalogError(`Cannot patch sites in status ${existing.status}`, 400);
  }

  const organizationId = requestOrganizationId();
  const allowed = existing.procedureType?.physioOrderFields ?? [];
  const existingFields = readPhysioFields(existing.physioFields);
  const nextFields =
    input.physioFields !== undefined
      ? sanitizePhysioFields(allowed, input.physioFields, existingFields)
      : existingFields;
  await assertListItem(nextFields.deviceProgramId, "DEVICE_PROGRAM");
  await assertListItem(nextFields.substanceId, "SUBSTANCE");

  const requestedLaterality = parseSiteLateralityMap(input.siteLaterality);
  const prevLaterality = lateralityBySiteId(
    existing.sites.map((s) => ({ siteId: s.siteId, laterality: s.laterality })),
  );

  if (input.siteIds !== undefined) {
    const siteIds = uniqueOrderedIds(input.siteIds);
    const rows =
      siteIds.length === 0
        ? []
        : await prisma.physioSite.findMany({
            where: { id: { in: siteIds } },
          });
    if (rows.length !== siteIds.length) {
      throw new PhysioCatalogError("Unknown physio site", 400);
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = siteIds.map((id) => byId.get(id)!);
    const allowedCodes = existing.procedureType?.allowedSiteCodes ?? [];
    for (const site of ordered) {
      if (!site.active) {
        throw new PhysioCatalogError(`Physio site is inactive: ${site.code}`, 409);
      }
      if (allowedCodes.length > 0 && !allowedCodes.includes(site.code)) {
        throw new PhysioCatalogError(
          `Physio site not allowed for this procedure type: ${site.code}`,
          400,
        );
      }
    }
    const mergedLaterality: Record<string, PhysioLateralityCode | null> = {};
    for (const site of ordered) {
      if (site.id in requestedLaterality) mergedLaterality[site.id] = requestedLaterality[site.id] ?? null;
      else if (site.id in prevLaterality) mergedLaterality[site.id] = prevLaterality[site.id] ?? null;
    }
    assertLateralityAllowed(
      allowed,
      ordered.map((s) => ({ id: s.id, laterality: s.laterality })),
      mergedLaterality,
    );
    const bodyPart = deriveCoarseBodyPart(ordered);
    const gate = inferPhysioTypeGate(
      existing.procedureType?.code ?? "",
      existing.procedureType?.name ?? "",
    );
    const siteApplyMode = gate.forceSiteTogether
      ? ("TOGETHER" as const)
      : resolveSiteApplyMode(ordered.length, input.siteApplyMode ?? existing.siteApplyMode);

    return prisma.$transaction(async (tx) => {
      await tx.procedureOrderSite.deleteMany({ where: { procedureOrderId: orderId } });
      if (ordered.length) {
        await tx.procedureOrderSite.createMany({
          data: ordered.map((site, i) => ({
            organizationId,
            procedureOrderId: orderId,
            siteId: site.id,
            sortOrder: i,
            laterality: (mergedLaterality[site.id] ?? null) as ProcedureSiteLaterality | null,
          })),
        });
      }
      return tx.procedureOrder.update({
        where: { id: orderId },
        data: {
          bodyPart,
          siteApplyMode,
          physioFields: nextFields as Prisma.InputJsonValue,
          ...(input.note !== undefined ? { note: input.note } : {}),
        },
        include: PROCEDURE_PHYSIO_INCLUDE,
      });
    });
  }

  if (Object.keys(requestedLaterality).length) {
    const currentSites = existing.sites.map((s) => ({
      id: s.siteId,
      laterality: s.site.laterality,
    }));
    assertLateralityAllowed(allowed, currentSites, requestedLaterality);
    await prisma.$transaction(
      Object.entries(requestedLaterality).map(([siteId, laterality]) =>
        prisma.procedureOrderSite.updateMany({
          where: { procedureOrderId: orderId, siteId },
          data: { laterality: laterality as ProcedureSiteLaterality | null },
        }),
      ),
    );
  }

  const data: {
    note?: string | null;
    bodyPart?: string | null;
    siteApplyMode?: ProcedureSiteApplyMode | null;
    physioFields?: Prisma.InputJsonValue;
  } = {};
  if (input.note !== undefined) data.note = input.note;
  if (input.bodyPart !== undefined) data.bodyPart = input.bodyPart;
  if (input.siteApplyMode !== undefined) {
    const gate = inferPhysioTypeGate(
      existing.procedureType?.code ?? "",
      existing.procedureType?.name ?? "",
    );
    data.siteApplyMode = gate.forceSiteTogether
      ? "TOGETHER"
      : resolveSiteApplyMode(existing.sites.length, parseApplyMode(input.siteApplyMode));
  }
  if (input.physioFields !== undefined) data.physioFields = nextFields as Prisma.InputJsonValue;

  return prisma.procedureOrder.update({
    where: { id: orderId },
    data,
    include: PROCEDURE_PHYSIO_INCLUDE,
  });
}
