/**
 * Configurable pipelines / stages (P0-5).
 */
import type { LeadStage, PipelineStageKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type VerticalTemplateKey = "clinic" | "hotel" | "construction";

export const CLINIC_VERTICAL_PIPELINE_PREFIX = "Clinic —";

const VERTICAL_TEMPLATES: Record<
  VerticalTemplateKey,
  { name: string; stages: Array<{ name: string; kind: PipelineStageKind }> }
> = {
  clinic: {
    name: "Clinic — patient inquiry",
    stages: [
      { name: "New inquiry", kind: "OPEN" },
      { name: "Triage", kind: "OPEN" },
      { name: "Appointment offered", kind: "OPEN" },
      { name: "Booked", kind: "WON" },
      { name: "Closed / no show", kind: "LOST" },
    ],
  },
  hotel: {
    name: "Hotel — guest inquiry",
    stages: [
      { name: "New request", kind: "OPEN" },
      { name: "Availability check", kind: "OPEN" },
      { name: "Quote sent", kind: "OPEN" },
      { name: "Reserved", kind: "WON" },
      { name: "Lost", kind: "LOST" },
    ],
  },
  construction: {
    name: "Construction — project inquiry",
    stages: [
      { name: "Lead in", kind: "OPEN" },
      { name: "Site visit", kind: "OPEN" },
      { name: "Estimate", kind: "OPEN" },
      { name: "Contract signed", kind: "WON" },
      { name: "Declined", kind: "LOST" },
    ],
  },
};

export function isClinicVerticalPipelineName(name: string | null | undefined): boolean {
  return Boolean(name?.startsWith(CLINIC_VERTICAL_PIPELINE_PREFIX));
}

export async function seedVerticalTemplate(
  organizationId: string,
  vertical: VerticalTemplateKey,
) {
  if (!VERTICAL_TEMPLATES[vertical]) {
    throw new Error("vertical must be clinic, hotel, or construction");
  }
  const tpl = VERTICAL_TEMPLATES[vertical];
  const existing = await prisma.pipeline.findFirst({
    where: { organizationId, name: tpl.name },
    include: { stages: true },
  });
  if (existing) return existing;

  const count = await prisma.pipeline.count({ where: { organizationId } });
  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId,
      name: tpl.name,
      isDefault: count === 0,
    },
  });
  let sort = 10;
  for (const st of tpl.stages) {
    await prisma.pipelineStage.create({
      data: {
        organizationId,
        pipelineId: pipeline.id,
        name: st.name,
        sortOrder: sort,
        kind: st.kind,
      },
    });
    sort += 10;
  }
  return prisma.pipeline.findUnique({
    where: { id: pipeline.id },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function listPipelines(organizationId: string) {
  return prisma.pipeline.findMany({
    where: { organizationId },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
      _count: { select: { leads: true } },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function createPipeline(
  organizationId: string,
  input: { name: string; isDefault?: boolean },
) {
  const name = input.name.trim();
  if (!name) throw new Error("name required");
  if (input.isDefault) {
    await prisma.pipeline.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }
  return prisma.pipeline.create({
    data: {
      organizationId,
      name,
      isDefault: input.isDefault === true,
    },
    include: { stages: true },
  });
}

export async function patchPipeline(
  organizationId: string,
  pipelineId: string,
  input: { name?: string; isDefault?: boolean },
) {
  const row = await prisma.pipeline.findFirst({
    where: { id: pipelineId, organizationId },
  });
  if (!row) return null;
  if (input.isDefault === true) {
    await prisma.pipeline.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }
  return prisma.pipeline.update({
    where: { id: row.id },
    data: {
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(typeof input.isDefault === "boolean"
        ? { isDefault: input.isDefault }
        : {}),
    },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function addStage(
  organizationId: string,
  pipelineId: string,
  input: {
    name: string;
    sortOrder?: number;
    color?: string;
    kind?: PipelineStageKind;
    legacyStage?: LeadStage | null;
  },
) {
  const pipe = await prisma.pipeline.findFirst({
    where: { id: pipelineId, organizationId },
  });
  if (!pipe) return null;
  const max = await prisma.pipelineStage.aggregate({
    where: { pipelineId },
    _max: { sortOrder: true },
  });
  return prisma.pipelineStage.create({
    data: {
      organizationId,
      pipelineId,
      name: input.name.trim(),
      sortOrder:
        typeof input.sortOrder === "number"
          ? input.sortOrder
          : (max._max.sortOrder ?? 0) + 10,
      color: input.color?.trim() || null,
      kind: input.kind ?? "OPEN",
      legacyStage: input.legacyStage ?? null,
    },
  });
}

export async function patchStage(
  organizationId: string,
  stageId: string,
  input: {
    name?: string;
    sortOrder?: number;
    color?: string | null;
    kind?: PipelineStageKind;
  },
) {
  const row = await prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId },
  });
  if (!row) return null;
  return prisma.pipelineStage.update({
    where: { id: row.id },
    data: {
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(typeof input.sortOrder === "number"
        ? { sortOrder: input.sortOrder }
        : {}),
      ...(input.color !== undefined
        ? { color: input.color?.trim() || null }
        : {}),
      ...(input.kind ? { kind: input.kind } : {}),
    },
  });
}

export async function deleteStage(organizationId: string, stageId: string) {
  const row = await prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId },
    include: { _count: { select: { leads: true } } },
  });
  if (!row) return { ok: false as const, reason: "not_found" };
  if (row._count.leads > 0) {
    return { ok: false as const, reason: "has_leads" };
  }
  await prisma.pipelineStage.delete({ where: { id: row.id } });
  return { ok: true as const };
}
