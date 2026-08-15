import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { invalidateDiagnosticCatalogCache } from "@/domain/catalog/diagnostic-catalog";
import type { CatalogFieldDef } from "@/domain/catalog/diagnostic-catalog-shared";

type AuditCtx = { userId?: string | null; request?: Request };

async function audit(
  ctx: AuditCtx,
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
) {
  await recordClinicAudit(ctx, entityType, entityId, action, changes);
}

// ---------------------------------------------------------------------------
// Modalities
// ---------------------------------------------------------------------------

export async function listModalities(opts?: { includeInactive?: boolean }) {
  return prisma.modality.findMany({
    where: opts?.includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: { _count: { select: { services: true } } },
  });
}

export type ModalityInput = {
  code: string;
  kind: string;
  titleEn: string;
  titleRu: string;
  titleAz: string;
  sortOrder?: number;
  active?: boolean;
};

export async function createModality(ctx: AuditCtx, data: ModalityInput) {
  const row = await prisma.modality.create({ data });
  await audit(ctx, "modality", row.id, "CREATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}

export async function updateModality(
  ctx: AuditCtx,
  id: string,
  data: Partial<ModalityInput>,
) {
  const row = await prisma.modality.update({ where: { id }, data });
  await audit(ctx, "modality", id, "UPDATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}

/** Soft delete: mark inactive rather than removing catalog history. */
export async function deleteModality(ctx: AuditCtx, id: string) {
  const row = await prisma.modality.update({
    where: { id },
    data: { active: false },
  });
  await audit(ctx, "modality", id, "DELETE");
  invalidateDiagnosticCatalogCache();
  return row;
}

// ---------------------------------------------------------------------------
// Diagnostic services
// ---------------------------------------------------------------------------

export async function listServices(opts?: {
  modalityId?: string;
  includeInactive?: boolean;
}) {
  return prisma.diagnosticService.findMany({
    where: {
      ...(opts?.includeInactive ? {} : { active: true }),
      ...(opts?.modalityId ? { modalityId: opts.modalityId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: {
      modality: { select: { id: true, code: true, titleEn: true } },
      _count: { select: { analytes: true } },
    },
  });
}

export async function getServiceById(id: string) {
  return prisma.diagnosticService.findUnique({
    where: { id },
    include: { modality: { select: { id: true, code: true, titleEn: true } } },
  });
}

export type ServiceInput = {
  code: string;
  modalityId: string;
  category?: string;
  kind: string;
  titleEn: string;
  titleRu: string;
  titleAz: string;
  serviceCode: string;
  fields?: CatalogFieldDef[] | null;
  includes?: string[] | null;
  sortOrder?: number;
  active?: boolean;
};

type ServicePersistData<T> = Omit<T, "fields" | "includes"> & {
  fieldsJson?: string | null;
  includesJson?: string | null;
};

function toServicePersistData<T extends Partial<ServiceInput>>(
  data: T,
): ServicePersistData<T> {
  const { fields, includes, ...rest } = data;
  return {
    ...rest,
    ...(fields !== undefined
      ? { fieldsJson: fields && fields.length > 0 ? JSON.stringify(fields) : null }
      : {}),
    ...(includes !== undefined
      ? { includesJson: includes && includes.length > 0 ? JSON.stringify(includes) : null }
      : {}),
  } as ServicePersistData<T>;
}

export async function createService(ctx: AuditCtx, data: ServiceInput) {
  const row = await prisma.diagnosticService.create({
    data: toServicePersistData(data),
  });
  await audit(ctx, "diagnosticService", row.id, "CREATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}

export async function updateService(
  ctx: AuditCtx,
  id: string,
  data: Partial<ServiceInput>,
) {
  const row = await prisma.diagnosticService.update({
    where: { id },
    data: toServicePersistData(data),
  });
  await audit(ctx, "diagnosticService", id, "UPDATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}

/** Soft delete: mark inactive so historical lab orders keep their reference. */
export async function deleteService(ctx: AuditCtx, id: string) {
  const row = await prisma.diagnosticService.update({
    where: { id },
    data: { active: false },
  });
  await audit(ctx, "diagnosticService", id, "DELETE");
  invalidateDiagnosticCatalogCache();
  return row;
}

// ---------------------------------------------------------------------------
// Analytes (lab panel components) — belong to a DiagnosticService
// ---------------------------------------------------------------------------

export async function listAnalytes(serviceId: string) {
  return prisma.diagnosticAnalyte.findMany({
    where: { serviceId },
    include: { valueOptions: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export type AnalyteValueOptionInput = {
  code: string;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  sortOrder?: number;
};

export type AnalyteInput = {
  code: string;
  unit?: string | null;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  refMin?: string | null;
  refMax?: string | null;
  section?: string | null;
  valueType?: "NUMERIC" | "QUALITATIVE";
  sortOrder?: number;
  valueOptions?: AnalyteValueOptionInput[];
};

export async function createAnalyte(
  ctx: AuditCtx,
  serviceId: string,
  data: AnalyteInput,
) {
  const { valueOptions, ...rest } = data;
  const row = await prisma.diagnosticAnalyte.create({
    data: {
      ...rest,
      serviceId,
      ...(valueOptions?.length
        ? {
            valueOptions: {
              create: valueOptions.map((o, i) => ({
                code: o.code,
                labelEn: o.labelEn,
                labelRu: o.labelRu,
                labelAz: o.labelAz,
                sortOrder: o.sortOrder ?? i,
              })),
            },
          }
        : {}),
    },
    include: { valueOptions: true },
  });
  await audit(ctx, "diagnosticAnalyte", row.id, "CREATE", { serviceId, ...data });
  invalidateDiagnosticCatalogCache();
  return row;
}

export async function updateAnalyte(
  ctx: AuditCtx,
  analyteId: string,
  data: Partial<AnalyteInput>,
) {
  const { valueOptions, ...rest } = data;
  const row = await prisma.$transaction(async (tx) => {
    if (valueOptions) {
      await tx.analyteValueOption.deleteMany({ where: { analyteId } });
      if (valueOptions.length) {
        await tx.analyteValueOption.createMany({
          data: valueOptions.map((o, i) => ({
            analyteId,
            code: o.code,
            labelEn: o.labelEn,
            labelRu: o.labelRu,
            labelAz: o.labelAz,
            sortOrder: o.sortOrder ?? i,
          })),
        });
      }
    }
    return tx.diagnosticAnalyte.update({
      where: { id: analyteId },
      data: rest,
      include: { valueOptions: { orderBy: { sortOrder: "asc" } } },
    });
  });
  await audit(ctx, "diagnosticAnalyte", analyteId, "UPDATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}

export async function deleteAnalyte(ctx: AuditCtx, analyteId: string) {
  await prisma.diagnosticAnalyte.delete({ where: { id: analyteId } });
  await audit(ctx, "diagnosticAnalyte", analyteId, "DELETE");
  invalidateDiagnosticCatalogCache();
}

// ---------------------------------------------------------------------------
// Common meta fields (imaging / visit result forms)
// ---------------------------------------------------------------------------

export async function listMetaFields() {
  return prisma.diagnosticMetaField.findMany({
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });
}

export type MetaFieldInput = {
  key: string;
  fieldType: string;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  unit?: string | null;
  options?: string[] | null;
  required?: boolean;
  sortOrder?: number;
};

type MetaFieldPersistData<T> = Omit<T, "options"> & { optionsJson?: string | null };

function toMetaFieldPersistData<T extends Partial<MetaFieldInput>>(
  data: T,
): MetaFieldPersistData<T> {
  const { options, ...rest } = data;
  return {
    ...rest,
    ...(options !== undefined
      ? { optionsJson: options && options.length > 0 ? JSON.stringify(options) : null }
      : {}),
  } as MetaFieldPersistData<T>;
}

export async function createMetaField(ctx: AuditCtx, data: MetaFieldInput) {
  const row = await prisma.diagnosticMetaField.create({
    data: toMetaFieldPersistData(data),
  });
  await audit(ctx, "diagnosticMetaField", row.id, "CREATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}

export async function updateMetaField(
  ctx: AuditCtx,
  id: string,
  data: Partial<MetaFieldInput>,
) {
  const row = await prisma.diagnosticMetaField.update({
    where: { id },
    data: toMetaFieldPersistData(data),
  });
  await audit(ctx, "diagnosticMetaField", id, "UPDATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}
