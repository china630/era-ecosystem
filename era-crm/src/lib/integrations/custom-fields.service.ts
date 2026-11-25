/** P1-2 CustomFieldDef + tags helpers. */
import { prisma } from "@/lib/prisma";

export async function listCustomFieldDefs(organizationId: string, entity = "LEAD") {
  return prisma.customFieldDef.findMany({
    where: { organizationId, entity },
    orderBy: { key: "asc" },
  });
}

export async function upsertCustomFieldDef(
  organizationId: string,
  data: {
    entity?: string;
    key: string;
    label: string;
    fieldType: string;
    options?: string[];
    requiredOnStageIds?: string[];
  },
) {
  const entity = data.entity ?? "LEAD";
  return prisma.customFieldDef.upsert({
    where: {
      organizationId_entity_key: {
        organizationId,
        entity,
        key: data.key,
      },
    },
    create: {
      organizationId,
      entity,
      key: data.key,
      label: data.label,
      fieldType: data.fieldType,
      optionsJson: JSON.stringify(data.options ?? []),
      requiredOnStageIds: JSON.stringify(data.requiredOnStageIds ?? []),
    },
    update: {
      label: data.label,
      fieldType: data.fieldType,
      optionsJson: JSON.stringify(data.options ?? []),
      requiredOnStageIds: JSON.stringify(data.requiredOnStageIds ?? []),
    },
  });
}

export async function setLeadCustomJson(
  organizationId: string,
  leadId: string,
  custom: Record<string, unknown>,
) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) throw new Error("lead not found");
  const prev = JSON.parse(lead.customJson || "{}") as Record<string, unknown>;
  return prisma.lead.update({
    where: { id: leadId },
    data: { customJson: JSON.stringify({ ...prev, ...custom }) },
  });
}

export async function listTags(organizationId: string) {
  return prisma.tag.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
}

export async function listLeadTags(organizationId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("lead not found");
  const rows = await prisma.leadTag.findMany({
    where: { leadId },
    include: { tag: true },
  });
  return rows.map((r) => r.tag);
}

export async function addLeadTag(
  organizationId: string,
  leadId: string,
  tagName: string,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("lead not found");
  const tag = await prisma.tag.upsert({
    where: { organizationId_name: { organizationId, name: tagName } },
    create: { organizationId, name: tagName },
    update: {},
  });
  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId, tagId: tag.id } },
    create: { leadId, tagId: tag.id },
    update: {},
  });
  return tag;
}

export async function removeLeadTag(
  organizationId: string,
  leadId: string,
  tagId: string,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("lead not found");
  await prisma.leadTag.deleteMany({ where: { leadId, tagId } });
  return { ok: true as const };
}
