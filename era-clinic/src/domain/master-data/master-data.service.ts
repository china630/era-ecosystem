import type { Prisma, ResourceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";

export async function listPractitioners() {
  return prisma.practitioner.findMany({ orderBy: { code: "asc" } });
}

export async function updatePractitionerOpsCatalog(
  id: string,
  data: {
    specialty?: string | null;
    defaultSlotMinutes?: number;
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
  },
) {
  return prisma.resource.update({ where: { id }, data });
}

export async function deleteResource(id: string) {
  await prisma.resource.delete({ where: { id } });
}

export async function listProcedureTypes() {
  return prisma.procedureType.findMany({ orderBy: { code: "asc" } });
}

export async function createProcedureType(data: {
  code: string;
  name: string;
  durationMin?: number;
  resourceKind?: ResourceKind | null;
  resourceCode?: string | null;
}) {
  return prisma.procedureType.create({ data });
}

export async function updateProcedureType(
  id: string,
  data: Prisma.ProcedureTypeUpdateInput,
) {
  return prisma.procedureType.update({ where: { id }, data });
}

export async function deleteProcedureType(id: string) {
  await prisma.procedureType.delete({ where: { id } });
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
