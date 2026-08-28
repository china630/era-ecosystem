import type {
  ProcedureRequirementRole,
  ProcedureStaffMode,
  ResourceKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  backfillAllProcedureTypeRequirements,
  ensureDefaultRequirements,
} from "@/domain/procedure/procedure-allocation.service";
import {
  alignDurationToSlotMinutes,
  getSchedulingSettings,
  isDurationAlignedToSlot,
} from "@/domain/settings/scheduling-settings";
import { parsePhysioOrderFields } from "@/domain/physio/physio-order-fields";
import { inferPhysioTypeGate } from "@/domain/physio/physio-type-gate";

export async function listPractitioners(staffKind?: "DOCTOR" | "NURSE" | "LAB") {
  return prisma.practitioner.findMany({
    where: staffKind ? { staffKind } : undefined,
    orderBy: { code: "asc" },
  });
}

export async function updatePractitionerOpsCatalog(
  id: string,
  data: {
    specialty?: string | null;
    defaultSlotMinutes?: number;
    staffKind?: "DOCTOR" | "NURSE" | "LAB";
  },
) {
  return prisma.practitioner.update({ where: { id }, data });
}

export async function getPractitionerById(id: string) {
  return prisma.practitioner.findUnique({ where: { id } });
}

export async function deletePractitioner(id: string) {
  await prisma.practitioner.delete({ where: { id } });
}

export async function listPractitionerSkills(practitionerId: string) {
  return prisma.practitionerSkill.findMany({
    where: { practitionerId },
    include: {
      procedureType: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Replace all skills for a practitioner with the given procedure type ids. */
export async function setPractitionerSkills(
  practitionerId: string,
  procedureTypeIds: string[],
) {
  const uniqueIds = [...new Set(procedureTypeIds.filter(Boolean))];
  await prisma.$transaction(async (tx) => {
    await tx.practitionerSkill.deleteMany({ where: { practitionerId } });
    if (uniqueIds.length > 0) {
      await tx.practitionerSkill.createMany({
        data: uniqueIds.map((procedureTypeId) => ({
          practitionerId,
          procedureTypeId,
          active: true,
        })),
        skipDuplicates: true,
      });
    }
  });
  return listPractitionerSkills(practitionerId);
}

export async function listRooms() {
  return prisma.room.findMany({
    orderBy: { code: "asc" },
    include: { resources: { select: { id: true, code: true } } },
  });
}

export async function createRoom(data: { code: string; name: string }) {
  return prisma.room.create({ data });
}

export async function updateRoom(id: string, data: { name?: string }) {
  return prisma.room.update({ where: { id }, data });
}

export async function deleteRoom(id: string) {
  await prisma.room.delete({ where: { id } });
}

export async function listResources() {
  return prisma.resource.findMany({
    orderBy: { code: "asc" },
    include: { room: { select: { code: true, name: true } } },
  });
}

export async function createResource(data: {
  code: string;
  name: string;
  kind: ResourceKind;
  capacity?: number;
  roomId?: string | null;
  extendedEndHour?: number | null;
}) {
  return prisma.resource.create({ data });
}

export async function updateResource(
  id: string,
  data: {
    name?: string;
    kind?: ResourceKind;
    capacity?: number;
    roomId?: string | null;
    extendedEndHour?: number | null;
  },
) {
  return prisma.resource.update({ where: { id }, data });
}

export async function deleteResource(id: string) {
  await prisma.resource.delete({ where: { id } });
}

export async function listProcedureTypes(locale = "en") {
  await backfillAllProcedureTypeRequirements();
  const { localizedCatalogDescription } = await import("@era/clinic-domain");
  const rows = await prisma.procedureType.findMany({
    orderBy: { code: "asc" },
    include: {
      requirements: true,
      consumableLines: { orderBy: { sku: "asc" } },
      _count: { select: { skills: true } },
    },
  });
  const catalogs = await prisma.serviceCatalogCache.findMany({
    where: { code: { in: rows.map((r) => r.code) } },
  });
  const byCode = new Map(catalogs.map((c) => [c.code, c]));
  return rows.map((row) => {
    const cat = byCode.get(row.code);
    const displayName = cat
      ? localizedCatalogDescription(cat, locale)
      : row.name;
    return {
      ...row,
      name: displayName,
      catalog: cat
        ? {
            description: cat.description,
            descriptionAz: cat.descriptionAz,
            descriptionRu: cat.descriptionRu,
            descriptionEn: cat.descriptionEn,
          }
        : null,
    };
  });
}

export async function createProcedureType(data: {
  code: string;
  name: string;
  durationMin?: number;
  resourceGapMinutes?: number;
  patientRestMinutes?: number;
  resourceKind?: ResourceKind | null;
  resourceCode?: string | null;
  bodyPart?: string | null;
  afterLunchAllowed?: boolean;
  extendedEndHour?: number | null;
  needsSite?: boolean;
  physioOrderFields?: string[];
}) {
  const settings = await getSchedulingSettings();
  const durationMin =
    data.durationMin != null
      ? alignDurationToSlotMinutes(data.durationMin, settings.schedulingSlotMinutes)
      : alignDurationToSlotMinutes(15, settings.schedulingSlotMinutes);
  if (
    data.durationMin != null &&
    !isDurationAlignedToSlot(data.durationMin, settings.schedulingSlotMinutes)
  ) {
    throw new Error(
      `durationMin must be a multiple of ${settings.schedulingSlotMinutes} minutes (got ${data.durationMin})`,
    );
  }
  const resourceGapMinutes =
    data.resourceGapMinutes != null
      ? Math.min(240, Math.max(0, Math.floor(data.resourceGapMinutes)))
      : settings.defaultProcedureGapMinutes ?? 5;
  const patientRestMinutes =
    data.patientRestMinutes != null
      ? Math.min(240, Math.max(0, Math.floor(data.patientRestMinutes)))
      : 15;
  const {
    resourceGapMinutes: _rg,
    patientRestMinutes: _pr,
    needsSite: needsSiteIn,
    physioOrderFields: fieldsIn,
    ...rest
  } = data;
  const gate = inferPhysioTypeGate(data.code, data.name);
  const needsSite = needsSiteIn ?? gate.needsSite;
  const physioOrderFields =
    fieldsIn != null ? parsePhysioOrderFields(fieldsIn) : gate.fields;
  const row = await prisma.procedureType.create({
    data: {
      ...rest,
      durationMin,
      resourceGapMinutes,
      patientRestMinutes,
      needsSite,
      physioOrderFields,
    },
  });
  await ensureDefaultRequirements(row.id);
  return prisma.procedureType.findUniqueOrThrow({
    where: { id: row.id },
    include: {
      requirements: true,
      consumableLines: { orderBy: { sku: "asc" } },
      _count: { select: { skills: true } },
    },
  });
}

export async function updateProcedureType(
  id: string,
  data: {
    name?: string;
    durationMin?: number;
    resourceGapMinutes?: number;
    patientRestMinutes?: number;
    resourceKind?: ResourceKind | null;
    resourceCode?: string | null;
    bodyPart?: string | null;
    afterLunchAllowed?: boolean;
    extendedEndHour?: number | null;
    needsSite?: boolean;
    physioOrderFields?: string[];
  },
) {
  const settings = await getSchedulingSettings();
  if (
    data.durationMin != null &&
    !isDurationAlignedToSlot(data.durationMin, settings.schedulingSlotMinutes)
  ) {
    throw new Error(
      `durationMin must be a multiple of ${settings.schedulingSlotMinutes} minutes (got ${data.durationMin})`,
    );
  }
  const { physioOrderFields: fieldsIn, ...rest } = data;
  const patch = {
    ...rest,
    ...(fieldsIn !== undefined ? { physioOrderFields: parsePhysioOrderFields(fieldsIn) } : {}),
    ...(data.durationMin != null
      ? {
          durationMin: alignDurationToSlotMinutes(
            data.durationMin,
            settings.schedulingSlotMinutes,
          ),
        }
      : {}),
    ...(data.resourceGapMinutes != null
      ? {
          resourceGapMinutes: Math.min(
            240,
            Math.max(0, Math.floor(data.resourceGapMinutes)),
          ),
        }
      : {}),
    ...(data.patientRestMinutes != null
      ? {
          patientRestMinutes: Math.min(
            240,
            Math.max(0, Math.floor(data.patientRestMinutes)),
          ),
        }
      : {}),
  };
  const updated = await prisma.procedureType.update({ where: { id }, data: patch });

  if (data.resourceCode !== undefined || data.resourceKind !== undefined) {
    const existing = await prisma.procedureTypeRequirement.findMany({
      where: { procedureTypeId: id },
    });
    const physical = existing.find(
      (r) => r.role === "LOCATION" || r.role === "EQUIPMENT",
    );
    if (physical) {
      await prisma.procedureTypeRequirement.update({
        where: { id: physical.id },
        data: {
          role: updated.resourceKind === "ROOM" ? "LOCATION" : "EQUIPMENT",
          resourceKind: updated.resourceKind,
          resourceCode: updated.resourceCode,
        },
      });
    } else {
      await ensureDefaultRequirements(id);
    }
  }

  return updated;
}

export async function deleteProcedureType(id: string) {
  await prisma.procedureType.delete({ where: { id } });
}

export async function listProcedureTypeRequirements(procedureTypeId: string) {
  return prisma.procedureTypeRequirement.findMany({
    where: { procedureTypeId },
    orderBy: { createdAt: "asc" },
  });
}

export type ProcedureTypeRequirementInput = {
  role: ProcedureRequirementRole;
  resourceKind?: ResourceKind | null;
  resourceCode?: string | null;
  quantity?: number;
  staffMode?: ProcedureStaffMode;
  required?: boolean;
};

/** Replace all requirements for a procedure type. */
export async function replaceProcedureTypeRequirements(
  procedureTypeId: string,
  requirements: ProcedureTypeRequirementInput[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.procedureTypeRequirement.deleteMany({ where: { procedureTypeId } });
    if (requirements.length > 0) {
      await tx.procedureTypeRequirement.createMany({
        data: requirements.map((r) => ({
          procedureTypeId,
          role: r.role,
          resourceKind: r.resourceKind ?? null,
          resourceCode: r.resourceCode ?? null,
          quantity: r.quantity ?? 1,
          staffMode: r.staffMode ?? "HARD",
          required: r.required ?? true,
        })),
      });
    }
  });
  return listProcedureTypeRequirements(procedureTypeId);
}

export type ProcedureConsumableLineInput = {
  sku: string;
  financeProductId?: string | null;
  qtyPerSession?: number;
  wasteFactor?: number;
};

export async function listProcedureConsumableLines(procedureTypeId: string) {
  return prisma.procedureConsumableLine.findMany({
    where: { procedureTypeId },
    orderBy: { sku: "asc" },
  });
}

/** Replace all TTK / consumable BOM lines for a procedure type. */
export async function replaceProcedureConsumableLines(
  procedureTypeId: string,
  lines: ProcedureConsumableLineInput[],
) {
  const type = await prisma.procedureType.findUnique({ where: { id: procedureTypeId } });
  if (!type) throw new Error("Procedure type not found");

  const cleaned = lines
    .map((l) => ({
      sku: l.sku.trim(),
      financeProductId: l.financeProductId?.trim() || null,
      qtyPerSession: l.qtyPerSession ?? 1,
      wasteFactor: l.wasteFactor ?? 0,
    }))
    .filter((l) => l.sku.length > 0);

  const skus = cleaned.map((l) => l.sku);
  if (new Set(skus).size !== skus.length) {
    throw new Error("Duplicate SKU in consumable BOM");
  }
  for (const l of cleaned) {
    if (!(l.qtyPerSession > 0)) {
      throw new Error(`qtyPerSession must be positive for SKU ${l.sku}`);
    }
    if (l.wasteFactor < 0) {
      throw new Error(`wasteFactor must be >= 0 for SKU ${l.sku}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.procedureConsumableLine.deleteMany({ where: { procedureTypeId } });
    if (cleaned.length > 0) {
      await tx.procedureConsumableLine.createMany({
        data: cleaned.map((l) => ({
          procedureTypeId,
          organizationId: type.organizationId,
          sku: l.sku,
          financeProductId: l.financeProductId,
          qtyPerSession: l.qtyPerSession,
          wasteFactor: l.wasteFactor,
        })),
      });
    }
  });
  return listProcedureConsumableLines(procedureTypeId);
}

/**
 * Resolve consumable lines for a completed procedure session.
 * Empty BOM → [] (no stock movement; never invent PROC-{code}).
 */
export async function resolveProcedureConsumableLines(opts: {
  procedureTypeId?: string | null;
  procedureCode?: string;
}): Promise<Array<{ sku: string; qty: number; description?: string; financeProductId?: string }>> {
  let typeId = opts.procedureTypeId ?? null;
  if (!typeId && opts.procedureCode) {
    const byCode = await prisma.procedureType.findFirst({
      where: { code: opts.procedureCode },
      select: { id: true },
    });
    typeId = byCode?.id ?? null;
  }
  if (!typeId) return [];

  const rows = await prisma.procedureConsumableLine.findMany({
    where: { procedureTypeId: typeId },
    orderBy: { sku: "asc" },
  });

  return rows.map((r) => {
    const qty = Number(r.qtyPerSession) * (1 + Number(r.wasteFactor));
    return {
      sku: r.sku,
      qty: Math.round(qty * 10000) / 10000,
      description: r.sku,
      ...(r.financeProductId ? { financeProductId: r.financeProductId } : {}),
    };
  });
}

export async function auditMasterChange(
  ctx: { userId?: string | null; request?: Request },
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
) {
  await recordClinicAudit(ctx, entityType, entityId, action, changes);
}
