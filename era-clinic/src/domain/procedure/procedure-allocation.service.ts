import type { ProcedureRequirementRole, ProcedureStaffMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PhysicalResource = {
  id: string;
  code: string;
  name: string;
  kind: "ROOM" | "EQUIPMENT";
  capacity: number;
  extendedEndHour?: number | null;
};

/** Count HARD STAFF allocations overlapping [start, end). */
export async function countStaffHardBusy(
  practitionerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeOrderId?: string,
): Promise<number> {
  return prisma.procedureAllocation.count({
    where: {
      role: "STAFF",
      practitionerId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeOrderId ? { procedureOrderId: { not: excludeOrderId } } : {}),
      procedureOrder: { status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED"] } },
    },
  });
}

/**
 * Count LOCATION/EQUIPMENT allocations overlapping [start, end).
 * When `gapMinutes` > 0 the window is widened by the turnover gap on both
 * sides, so a resource stays busy for `gapMinutes` after each booking (min
 * break between consecutive procedures on the same bed/room).
 */
export async function countResourceAllocations(
  resourceId: string,
  startsAt: Date,
  endsAt: Date,
  excludeOrderId?: string,
  gapMinutes = 0,
): Promise<number> {
  const winStart =
    gapMinutes > 0 ? new Date(startsAt.getTime() - gapMinutes * 60_000) : startsAt;
  const winEnd =
    gapMinutes > 0 ? new Date(endsAt.getTime() + gapMinutes * 60_000) : endsAt;
  return prisma.procedureAllocation.count({
    where: {
      role: { in: ["LOCATION", "EQUIPMENT"] },
      resourceId,
      startsAt: { lt: winEnd },
      endsAt: { gt: winStart },
      ...(excludeOrderId ? { procedureOrderId: { not: excludeOrderId } } : {}),
      procedureOrder: { status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED"] } },
    },
  });
}

export async function findSkilledFreePractitioner(input: {
  procedureTypeId: string;
  startsAt: Date;
  endsAt: Date;
  preferPractitionerId?: string | null;
  excludeOrderId?: string;
  staffMode?: ProcedureStaffMode;
}): Promise<{ id: string; fullName: string; code: string } | null> {
  const skills = await prisma.practitionerSkill.findMany({
    where: {
      procedureTypeId: input.procedureTypeId,
      active: true,
      practitioner: { active: true },
    },
    include: { practitioner: true },
  });
  if (skills.length === 0) {
    // No skills configured yet — any active practitioner (bootstrap).
    const any = await prisma.practitioner.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      take: 20,
    });
    const bootstrap = preferFirst(any, input.preferPractitionerId);
    if (input.staffMode === "SOFT") {
      return pickSoftStaff(bootstrap, input);
    }
    for (const p of bootstrap) {
      const busy = await countStaffHardBusy(
        p.id,
        input.startsAt,
        input.endsAt,
        input.excludeOrderId,
      );
      if (busy === 0) return p;
    }
    return null;
  }

  const candidates = preferFirst(
    skills.map((s) => s.practitioner),
    input.preferPractitionerId,
  );
  if (input.staffMode === "SOFT") {
    return pickSoftStaff(candidates, input);
  }
  for (const p of candidates) {
    const busy = await countStaffHardBusy(
      p.id,
      input.startsAt,
      input.endsAt,
      input.excludeOrderId,
    );
    if (busy === 0) return p;
  }
  return null;
}

/** SOFT: assign skilled staff without exclusivity; prefer least-loaded. */
async function pickSoftStaff(
  candidates: Array<{ id: string; fullName: string; code: string }>,
  input: {
    startsAt: Date;
    endsAt: Date;
    excludeOrderId?: string;
  },
): Promise<{ id: string; fullName: string; code: string } | null> {
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestBusy = Number.POSITIVE_INFINITY;
  for (const p of candidates) {
    const busy = await countStaffHardBusy(
      p.id,
      input.startsAt,
      input.endsAt,
      input.excludeOrderId,
    );
    if (busy < bestBusy) {
      best = p;
      bestBusy = busy;
      if (busy === 0) break;
    }
  }
  return best;
}

function preferFirst<T extends { id: string }>(
  rows: T[],
  preferId?: string | null,
): T[] {
  if (!preferId) return rows;
  const hit = rows.find((r) => r.id === preferId);
  if (!hit) return rows;
  return [hit, ...rows.filter((r) => r.id !== preferId)];
}

export async function resolvePhysicalResource(input: {
  resourceCode?: string | null;
  resourceKind?: "ROOM" | "EQUIPMENT" | null;
  preferredResourceId?: string | null;
}): Promise<PhysicalResource | null> {
  if (input.preferredResourceId) {
    const r = await prisma.resource.findUnique({
      where: { id: input.preferredResourceId },
    });
    if (r) return r;
  }
  if (input.resourceCode) {
    const byCode = await prisma.resource.findUnique({
      where: { code: input.resourceCode },
    });
    if (byCode) return byCode;
  }
  if (input.resourceKind) {
    const byKind = await prisma.resource.findFirst({
      where: { kind: input.resourceKind },
      orderBy: { code: "asc" },
    });
    if (byKind) return byKind;
  }
  return prisma.resource.findFirst({ orderBy: { code: "asc" } });
}

export type AllocationWrite = {
  role: ProcedureRequirementRole;
  resourceId?: string | null;
  practitionerId?: string | null;
  startsAt: Date;
  endsAt: Date;
};

/** Replace allocations for an order and sync LOCATION/EQUIPMENT ResourceBooking. */
export async function replaceProcedureAllocations(
  procedureOrderId: string,
  allocations: AllocationWrite[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.procedureAllocation.deleteMany({ where: { procedureOrderId } });
    if (allocations.length > 0) {
      await tx.procedureAllocation.createMany({
        data: allocations.map((a) => ({
          procedureOrderId,
          role: a.role,
          resourceId: a.resourceId ?? null,
          practitionerId: a.practitionerId ?? null,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
        })),
      });
    }

    const physical = allocations.find(
      (a) => a.role === "LOCATION" || a.role === "EQUIPMENT",
    );
    const staff = allocations.find((a) => a.role === "STAFF");
    const existing = await tx.resourceBooking.findUnique({
      where: { procedureOrderId },
    });

    if (physical?.resourceId) {
      const data = {
        resourceId: physical.resourceId,
        practitionerId: staff?.practitionerId ?? null,
        startsAt: physical.startsAt,
        endsAt: physical.endsAt,
      };
      if (existing) {
        await tx.resourceBooking.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await tx.resourceBooking.create({
          data: { ...data, procedureOrderId },
        });
      }
    } else if (existing) {
      await tx.resourceBooking.delete({ where: { id: existing.id } });
    }
  });
}

export async function getStaffAllocationForOrder(procedureOrderId: string) {
  return prisma.procedureAllocation.findFirst({
    where: { procedureOrderId, role: "STAFF" },
    include: { practitioner: { select: { id: true, code: true, fullName: true } } },
  });
}

/** Staff mode from type requirements (default HARD when unset). */
export async function resolveStaffModeForProcedureType(
  procedureTypeId: string,
): Promise<ProcedureStaffMode> {
  const staffReq = await prisma.procedureTypeRequirement.findFirst({
    where: { procedureTypeId, role: "STAFF" },
    select: { staffMode: true },
  });
  return staffReq?.staffMode ?? "HARD";
}

/**
 * Ensure LOCATION/EQUIPMENT + STAFF requirements exist for a procedure type.
 * New STAFF rows default to SOFT (shared nurse pool); existing rows are left unchanged.
 */
export async function ensureDefaultRequirements(procedureTypeId: string) {
  const pt = await prisma.procedureType.findUnique({ where: { id: procedureTypeId } });
  if (!pt) return;
  const existing = await prisma.procedureTypeRequirement.findMany({
    where: { procedureTypeId },
  });
  const hasPhysical = existing.some(
    (r) => r.role === "LOCATION" || r.role === "EQUIPMENT",
  );
  const hasStaff = existing.some((r) => r.role === "STAFF");
  if (!hasPhysical) {
    await prisma.procedureTypeRequirement.create({
      data: {
        procedureTypeId,
        role: pt.resourceKind === "ROOM" ? "LOCATION" : "EQUIPMENT",
        resourceKind: pt.resourceKind,
        resourceCode: pt.resourceCode,
        staffMode: "HARD",
        required: true,
      },
    });
  }
  if (!hasStaff) {
    await prisma.procedureTypeRequirement.create({
      data: {
        procedureTypeId,
        role: "STAFF",
        staffMode: "SOFT",
        required: true,
      },
    });
  }
}

/** Backfill missing requirements for all procedure types (idempotent). */
export async function backfillAllProcedureTypeRequirements(): Promise<number> {
  const types = await prisma.procedureType.findMany({ select: { id: true } });
  for (const pt of types) {
    await ensureDefaultRequirements(pt.id);
  }
  return types.length;
}
