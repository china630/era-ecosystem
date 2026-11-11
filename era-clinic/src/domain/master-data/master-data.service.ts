import type {
  ClinicLookupKind,
  ProcedureRequirementRole,
  ProcedureStaffMode,
  Prisma,
  ResourceKind,
  ServiceCatalogKind,
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
import { uniqueSiteCodes } from "@/domain/physio/physio-allowed-sites";
import {
  catalogKindIsNonCabinProcedure,
  inferServiceCatalogKind,
} from "@/domain/catalog/service-catalog-kind";
import { normalizeProcedureRequirements } from "@/domain/procedure/procedure-physical-pool";

function rethrowIfInUse(err: unknown): never {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "P2003"
  ) {
    throw Object.assign(new Error("Referenced by existing rows"), {
      code: "IN_USE",
    });
  }
  throw err;
}

/** Drop practitioner rows whose login role is reception or clinic admin. */
export async function purgeNonClinicalPractitioners() {
  const rows = await prisma.practitioner.findMany({
    where: { user: { role: { staffKind: "NONE" } } },
    select: { id: true },
  });
  for (const row of rows) {
    try {
      await prisma.practitioner.delete({ where: { id: row.id } });
    } catch {
      await prisma.practitioner.update({
        where: { id: row.id },
        data: { active: false },
      });
    }
  }
}

export async function listPractitioners(
  staffKind?: "DOCTOR" | "NURSE" | "LAB" | "BATH" | "MASSAGE",
  opts?: { includeInactive?: boolean },
) {
  return prisma.practitioner.findMany({
    where: {
      ...(staffKind ? { staffKind } : {}),
      ...(opts?.includeInactive ? {} : { active: true }),
    },
    orderBy: { code: "asc" },
  });
}

export async function updatePractitionerOpsCatalog(
  id: string,
  data: {
    specialty?: string | null;
    defaultSlotMinutes?: number;
    staffKind?: "DOCTOR" | "NURSE" | "LAB" | "BATH" | "MASSAGE";
  },
) {
  return prisma.practitioner.update({ where: { id }, data });
}

export async function getPractitionerById(id: string) {
  return prisma.practitioner.findUnique({ where: { id } });
}

export async function deletePractitioner(id: string) {
  try {
    await prisma.practitioner.delete({ where: { id } });
  } catch (err) {
    rethrowIfInUse(err);
  }
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
  try {
    await prisma.room.delete({ where: { id } });
  } catch (err) {
    rethrowIfInUse(err);
  }
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
  extendedStartHour?: number | null;
  extendedEndHour?: number | null;
  sexAudience?: "MALE" | "FEMALE" | "ANY";
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
    extendedStartHour?: number | null;
    extendedEndHour?: number | null;
    sexAudience?: "MALE" | "FEMALE" | "ANY";
  },
) {
  return prisma.resource.update({ where: { id }, data });
}

export async function deleteResource(id: string) {
  try {
    await prisma.resource.delete({ where: { id } });
  } catch (err) {
    rethrowIfInUse(err);
  }
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
      requirements: normalizeProcedureRequirements(row.requirements),
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
  extendedStartHour?: number | null;
  extendedEndHour?: number | null;
  needsSite?: boolean;
  openAttendance?: boolean;
  blockCategory?: "PHYSIO" | "BATH" | "PARAFFIN" | null;
  usageContour?: "GUEST" | "INTERNAL";
  physioOrderFields?: string[];
  allowedSiteCodes?: string[];
  financeSku?: string | null;
  hotelRevenueCode?: string | null;
  active?: boolean;
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
    allowedSiteCodes: sitesIn,
    financeSku,
    hotelRevenueCode: _ignoredRevenue,
    ...rest
  } = data;
  const gate = inferPhysioTypeGate(data.code, data.name);
  const needsSite = needsSiteIn ?? gate.needsSite;
  const physioOrderFields =
    fieldsIn != null ? parsePhysioOrderFields(fieldsIn) : gate.fields;
  const allowedSiteCodes =
    sitesIn != null ? uniqueSiteCodes(sitesIn) : gate.allowedSiteCodes;
  const row = await prisma.procedureType.create({
    data: {
      ...rest,
      durationMin,
      resourceGapMinutes,
      patientRestMinutes,
      needsSite,
      physioOrderFields,
      allowedSiteCodes,
      financeSku: financeSku?.trim() || null,
    },
  });
  await ensureDefaultRequirements(row.id);
  const created = await prisma.procedureType.findUniqueOrThrow({
    where: { id: row.id },
    include: {
      requirements: true,
      consumableLines: { orderBy: { sku: "asc" } },
      _count: { select: { skills: true } },
    },
  });
  return {
    ...created,
    requirements: normalizeProcedureRequirements(created.requirements),
  };
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
    extendedStartHour?: number | null;
    extendedEndHour?: number | null;
    needsSite?: boolean;
    openAttendance?: boolean;
  blockCategory?: "PHYSIO" | "BATH" | "PARAFFIN" | null;
  usageContour?: "GUEST" | "INTERNAL";
    physioOrderFields?: string[];
    allowedSiteCodes?: string[];
    financeSku?: string | null;
    hotelRevenueCode?: string | null;
    active?: boolean;
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
  const { physioOrderFields: fieldsIn, allowedSiteCodes: sitesIn, financeSku, hotelRevenueCode: _ignoredRevenue, ...rest } = data;
  const patch = {
    ...rest,
    ...(fieldsIn !== undefined ? { physioOrderFields: parsePhysioOrderFields(fieldsIn) } : {}),
    ...(sitesIn !== undefined ? { allowedSiteCodes: uniqueSiteCodes(sitesIn) } : {}),
    ...(financeSku !== undefined ? { financeSku: financeSku?.trim() || null } : {}),
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
    if (physical && !updated.resourceCode?.trim()) {
      await prisma.procedureTypeRequirement.delete({ where: { id: physical.id } });
    } else if (physical) {
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
  try {
    await prisma.procedureType.delete({ where: { id } });
  } catch (err) {
    rethrowIfInUse(err);
  }
}

/** Remove lab, diagnostic and visit rows that price import stored as procedure types. */
export async function purgeNonCabinProcedureTypes(): Promise<
  Array<{ code: string; name: string }>
> {
  const rows = await prisma.procedureType.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { orders: true } },
    },
  });
  const blocked: Array<{ code: string; name: string }> = [];
  for (const row of rows) {
    if (!catalogKindIsNonCabinProcedure(inferServiceCatalogKind(row.code))) continue;
    if (row._count.orders > 0) {
      blocked.push({ code: row.code, name: row.name });
      continue;
    }
    await prisma.procedureType.delete({ where: { id: row.id } });
  }
  return blocked;
}

export async function listProcedureTypeRequirements(procedureTypeId: string) {
  const rows = await prisma.procedureTypeRequirement.findMany({
    where: { procedureTypeId },
    orderBy: { createdAt: "asc" },
  });
  return normalizeProcedureRequirements(rows);
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
  const cleaned = normalizeProcedureRequirements(requirements);
  await prisma.$transaction(async (tx) => {
    await tx.procedureTypeRequirement.deleteMany({ where: { procedureTypeId } });
    if (cleaned.length > 0) {
      await tx.procedureTypeRequirement.createMany({
        data: cleaned.map((r) => ({
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

export async function getProcedureTypeById(id: string) {
  return prisma.procedureType.findUnique({ where: { id } });
}

export async function findServiceCatalogForProcedureName(code: string) {
  return prisma.serviceCatalogCache.findFirst({
    where: { code: code.trim() },
    select: {
      code: true,
      description: true,
      descriptionAz: true,
      descriptionRu: true,
      descriptionEn: true,
    },
  });
}

export async function listActiveProcedureTypesRaw() {
  return prisma.procedureType.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });
}

export async function listInactiveServiceDepartmentCodes(codes: string[]) {
  if (codes.length === 0) return [] as string[];
  const rows = await prisma.serviceDepartment.findMany({
    where: { code: { in: codes }, active: false },
    select: { code: true },
  });
  return rows.map((row) => row.code);
}

export type ServiceCatalogAdminListFilter = {
  kinds?: ServiceCatalogKind[];
  q?: string;
  limit?: number;
  missingListPrice?: boolean;
};

export async function listServiceCatalogAdminRows(filter: ServiceCatalogAdminListFilter) {
  const where: Prisma.ServiceCatalogCacheWhereInput = {};
  if (filter.kinds?.length) where.kind = { in: filter.kinds };
  if (filter.q) {
    const q = filter.q;
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { descriptionAz: { contains: q, mode: "insensitive" } },
      { descriptionRu: { contains: q, mode: "insensitive" } },
      { descriptionEn: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter.missingListPrice) {
    where.AND = [{ amount: 0 }, { OR: [{ listAmount: null }, { listAmount: 0 }] }];
  }
  const rows = await prisma.serviceCatalogCache.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { code: "asc" },
    ...(filter.limit != null ? { take: filter.limit } : {}),
  });
  const prices = await prisma.serviceCatalogPrice.findMany({
    orderBy: { effectiveFrom: "desc" },
    select: { code: true, effectiveFrom: true },
  });
  const effectiveFrom = new Map<string, string>();
  for (const price of prices) {
    if (!effectiveFrom.has(price.code)) {
      effectiveFrom.set(price.code, price.effectiveFrom.toISOString());
    }
  }
  return rows.map((row) => ({
    ...row,
    effectiveFrom: effectiveFrom.get(row.code) ?? row.syncedAt.toISOString(),
  }));
}

export async function listServiceCatalogCacheRows() {
  return prisma.serviceCatalogCache.findMany({ orderBy: { code: "asc" } });
}

export async function findServiceCatalogByCode(code: string) {
  return prisma.serviceCatalogCache.findFirst({ where: { code } });
}

export async function getServiceCatalogById(id: string) {
  return prisma.serviceCatalogCache.findFirst({ where: { id } });
}

export async function listServiceCatalogPricesByCatalogId(catalogId: string) {
  return prisma.serviceCatalogPrice.findMany({
    where: { catalogId },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function createServiceCatalogRow(data: {
  organizationId: string;
  code: string;
  description: string;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  amount: number;
  listAmount: number | null;
  department: string | null;
  departmentCode: string | null;
  kind: ServiceCatalogKind;
  syncedAt: Date;
}) {
  return prisma.serviceCatalogCache.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      description: data.description,
      descriptionAz: data.descriptionAz,
      descriptionRu: data.descriptionRu,
      descriptionEn: data.descriptionEn,
      amount: data.amount,
      listAmount: data.listAmount,
      packageIncluded: false,
      department: data.department,
      departmentCode: data.departmentCode,
      kind: data.kind,
      syncedAt: data.syncedAt,
    },
  });
}

export async function updateServiceCatalogRow(
  id: string,
  data: Prisma.ServiceCatalogCacheUpdateInput,
) {
  return prisma.serviceCatalogCache.update({ where: { id }, data });
}

export async function deleteServiceCatalogIfUnused(id: string): Promise<
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "IN_USE" }
> {
  const existing = await prisma.serviceCatalogCache.findFirst({ where: { id } });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };
  const orgId = existing.organizationId;
  const code = existing.code;
  const [procedures, visitLines, labItems, receipts, labHeaders] = await Promise.all([
    prisma.procedureOrder.count({
      where: { organizationId: orgId, procedureCode: code },
    }),
    prisma.visitServiceLine.count({
      where: { organizationId: orgId, serviceCode: code },
    }),
    prisma.labOrderItem.count({
      where: { organizationId: orgId, serviceCode: code },
    }),
    prisma.clinicReceiptLine.count({
      where: { organizationId: orgId, serviceCode: code },
    }),
    prisma.labOrder.count({
      where: {
        organizationId: orgId,
        OR: [
          { testCode: code },
          { testCode: { startsWith: `${code},` } },
          { testCode: { endsWith: `,${code}` } },
          { testCode: { contains: `,${code},` } },
        ],
      },
    }),
  ]);
  if (procedures + visitLines + labItems + receipts + labHeaders > 0) {
    return { ok: false, reason: "IN_USE" };
  }
  await prisma.serviceCatalogCache.delete({ where: { id } });
  return { ok: true };
}

type FinanceCatalogItem = { code: string; description: string; amount: number };

export async function pushClinicSkusToFinance(organizationId: string): Promise<number> {
  const base = (
    process.env.ERA_FINANCE_API_URL ??
    process.env.FINANCE_API_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
  const token =
    process.env.FINANCE_SERVICE_TOKEN ?? process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  const procedures = await prisma.procedureType.findMany({
    select: { id: true, code: true, name: true, financeSku: true },
  });
  const diagnostics = await prisma.diagnosticService.findMany({
    select: { id: true, code: true, titleEn: true, financeSku: true },
  });
  const services = [
    ...procedures.map((row) => ({ code: row.code, name: row.name, amount: 0 })),
    ...diagnostics.map((row) => ({ code: row.code, name: row.titleEn, amount: 0 })),
  ];
  if (services.length === 0) return 0;
  const res = await fetch(`${base}/api/industry-handoffs/clinic-service-catalog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-organization-id": organizationId,
    },
    body: JSON.stringify({ services }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!res?.ok) return 0;
  const body = (await res.json()) as { items?: Array<{ code: string; sku: string }> };
  for (const item of body.items ?? []) {
    await prisma.procedureType.updateMany({
      where: { code: item.code, financeSku: null },
      data: { financeSku: item.sku },
    });
    await prisma.diagnosticService.updateMany({
      where: { code: item.code, financeSku: null },
      data: { financeSku: item.sku },
    });
  }
  return body.items?.length ?? 0;
}

export async function fetchFinanceServiceCatalog(organizationId: string): Promise<FinanceCatalogItem[]> {
  const base = (
    process.env.ERA_FINANCE_API_URL ??
    process.env.FINANCE_API_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
  const token =
    process.env.FINANCE_SERVICE_TOKEN ?? process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  const res = await fetch(`${base}/api/industry-handoffs/clinic-service-catalog`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-organization-id": organizationId,
    },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json()) as { items?: FinanceCatalogItem[] };
  return data.items ?? [];
}

export async function upsertServiceCatalogFinanceRows(
  organizationId: string,
  items: FinanceCatalogItem[],
): Promise<number> {
  for (const item of items) {
    const listAmount = item.amount > 0 ? item.amount : null;
    await prisma.serviceCatalogCache.upsert({
      where: { organizationId_code: { organizationId, code: item.code } },
      create: {
        organizationId,
        code: item.code,
        description: item.description,
        amount: item.amount,
        listAmount,
      },
      update: {
        description: item.description,
        amount: item.amount,
        listAmount,
        syncedAt: new Date(),
      },
    });
  }
  return items.length;
}

export async function listClinicLookups(opts?: {
  kind?: ClinicLookupKind;
  activeOnly?: boolean;
}) {
  return prisma.clinicLookup.findMany({
    where: {
      ...(opts?.kind ? { kind: opts.kind } : {}),
      ...(opts?.activeOnly ? { active: true } : {}),
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function createClinicLookup(data: {
  kind: ClinicLookupKind;
  code: string;
  name: string;
  sortOrder?: number;
}) {
  return prisma.clinicLookup.create({
    data: {
      kind: data.kind,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateClinicLookup(
  id: string,
  data: { name?: string; active?: boolean; sortOrder?: number },
) {
  return prisma.clinicLookup.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
}

export async function listLisFileProfiles() {
  return prisma.lisFileProfile.findMany({ orderBy: { name: "asc" } });
}

export async function getLisFileProfileById(id: string) {
  return prisma.lisFileProfile.findUnique({ where: { id } });
}

export async function createLisFileProfile(data: {
  name: string;
  format: "CSV" | "HL7_FRAGMENT";
  delimiter: string;
  columnMappingJson: string;
}) {
  return prisma.lisFileProfile.create({
    data: {
      name: data.name,
      format: data.format,
      delimiter: data.delimiter,
      columnMapping: data.columnMappingJson,
    },
  });
}

export async function updateLisFileProfile(
  id: string,
  data: {
    name?: string;
    format?: "CSV" | "HL7_FRAGMENT";
    delimiter?: string;
    columnMappingJson?: string;
  },
) {
  return prisma.lisFileProfile.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.format !== undefined ? { format: data.format } : {}),
      ...(data.delimiter !== undefined ? { delimiter: data.delimiter } : {}),
      ...(data.columnMappingJson !== undefined
        ? { columnMapping: data.columnMappingJson }
        : {}),
    },
  });
}

export async function deleteLisFileProfile(id: string) {
  await prisma.lisFileProfile.delete({ where: { id } });
}
