import type { ProcedureRequirementRole, ProcedureStaffMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyDutyFilter,
  resolvePostedStaffForSlot,
} from "@/domain/staff/staff-duty-roster.service";
import { allocationOccupiesCandidate } from "@/domain/procedure/resource-occupancy";

export { allocationOccupiesCandidate } from "@/domain/procedure/resource-occupancy";

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

/** Upper bound lookback when scanning occupying tails (tenant max gap clamp). */
const RESOURCE_GAP_LOOKBACK_MIN = 240;

/**
 * Count LOCATION/EQUIPMENT allocations whose occupying window
 * `[startsAt, endsAt + type.resourceGapMinutes)` overlaps [startsAt, endsAt).
 * Gap comes from the occupying procedure type (not the candidate).
 * STAFF is never included — SOFT nurses may overlap cabins.
 */
export async function countResourceAllocations(
  resourceId: string,
  startsAt: Date,
  endsAt: Date,
  excludeOrderId?: string,
): Promise<number> {
  const lookbackStart = new Date(
    startsAt.getTime() - RESOURCE_GAP_LOOKBACK_MIN * 60_000,
  );
  const rows = await prisma.procedureAllocation.findMany({
    where: {
      role: { in: ["LOCATION", "EQUIPMENT"] },
      resourceId,
      startsAt: { lt: endsAt },
      endsAt: { gt: lookbackStart },
      ...(excludeOrderId ? { procedureOrderId: { not: excludeOrderId } } : {}),
      procedureOrder: { status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED"] } },
    },
    select: {
      startsAt: true,
      endsAt: true,
      procedureOrder: {
        select: {
          procedureType: { select: { resourceGapMinutes: true } },
        },
      },
    },
  });

  let count = 0;
  for (const row of rows) {
    const gap = row.procedureOrder.procedureType?.resourceGapMinutes ?? 5;
    if (
      allocationOccupiesCandidate(
        row.startsAt,
        row.endsAt,
        gap,
        startsAt,
        endsAt,
      )
    ) {
      count++;
    }
  }
  return count;
}

export async function findSkilledFreePractitioner(input: {
  procedureTypeId: string;
  startsAt: Date;
  endsAt: Date;
  preferPractitionerId?: string | null;
  excludeOrderId?: string;
  staffMode?: ProcedureStaffMode;
}): Promise<{ id: string; fullName: string; code: string } | null> {
  const duty = await resolvePostedStaffForSlot({
    procedureTypeId: input.procedureTypeId,
    at: input.startsAt,
    staffKind: "NURSE",
  });

  const skills = await prisma.practitionerSkill.findMany({
    where: {
      procedureTypeId: input.procedureTypeId,
      active: true,
      practitioner: { active: true, staffKind: "NURSE" },
    },
    include: { practitioner: true },
  });
  let pool = skills.map((s) => s.practitioner);
  if (pool.length === 0) {
    const nurses = await prisma.practitioner.findMany({
      where: { active: true, staffKind: "NURSE" },
      orderBy: { code: "asc" },
      take: 20,
    });
    pool =
      nurses.length > 0
        ? nurses
        : await prisma.practitioner.findMany({
            where: { active: true },
            orderBy: { code: "asc" },
            take: 20,
          });
  }
  const candidates = preferFirst(
    applyDutyFilter(pool, duty),
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
  const list = await listPhysicalRequirementResources({
    resourceCode: input.resourceCode,
    resourceKind: input.resourceKind,
  });
  if (input.preferredResourceId) {
    const hit = list.find((r) => r.id === input.preferredResourceId);
    if (hit) return hit;
  }
  return list[0] ?? null;
}

type PhysicalRequirementSource = {
  resourceCode?: string | null;
  resourceKind?: "ROOM" | "EQUIPMENT" | null;
  requirements?: Array<{
    role: ProcedureRequirementRole;
    resourceCode?: string | null;
    resourceKind?: "ROOM" | "EQUIPMENT" | null;
  }>;
};

/** All LOCATION/EQUIPMENT resources declared for scheduling (multi-cabinet procedures). */
export async function listPhysicalRequirementResources(
  source: PhysicalRequirementSource,
): Promise<PhysicalResource[]> {
  const codes = new Set<string>();
  for (const req of source.requirements ?? []) {
    if (req.role !== "LOCATION" && req.role !== "EQUIPMENT") continue;
    const code = req.resourceCode?.trim();
    if (code) codes.add(code);
  }
  if (codes.size === 0 && source.resourceCode?.trim()) {
    codes.add(source.resourceCode.trim());
  }
  const out: PhysicalResource[] = [];
  for (const code of [...codes].sort()) {
    const row = await prisma.resource.findFirst({ where: { code } });
    if (row) out.push(row);
  }
  // Legacy types with only resourceKind and no requirement codes may pick any matching kind.
  // When explicit cabinet codes exist (even if retired in DB), do not fall back to a random room.
  if (out.length === 0 && source.resourceKind && codes.size === 0) {
    const fallback = await prisma.resource.findFirst({
      where: { kind: source.resourceKind },
      orderBy: { code: "asc" },
    });
    if (fallback) out.push(fallback);
  }
  return out;
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
