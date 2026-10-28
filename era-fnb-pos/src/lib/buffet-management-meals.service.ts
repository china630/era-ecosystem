import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuCivilUtcDate } from "@era/satellite-kit/time";
import type { BuffetMealCode } from "@/lib/buffet-planner-math";

function serialize(row: {
  id: string;
  outletId: string;
  serviceDate: Date;
  meal: string;
  actorLabel: string;
  actorUserId: string | null;
  signedAt: Date;
  signedByUserId: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    outletId: row.outletId,
    serviceDate: row.serviceDate.toISOString().slice(0, 10),
    meal: row.meal,
    actorLabel: row.actorLabel,
    actorUserId: row.actorUserId,
    signedAt: row.signedAt.toISOString(),
    signedByUserId: row.signedByUserId,
    notes: row.notes,
  };
}

export async function listManagementMeals(args: {
  outletId: string;
  fromYmd?: string;
  toYmd?: string;
  meal?: BuffetMealCode;
}) {
  const organizationId = requestOrganizationId();
  const outlet = await prisma.outlet.findFirst({
    where: { id: args.outletId, organizationId },
    select: { id: true },
  });
  if (!outlet) {
    throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
  }
  const rows = await prisma.buffetManagementMeal.findMany({
    where: {
      organizationId,
      outletId: args.outletId,
      ...(args.meal ? { meal: args.meal } : {}),
      ...(args.fromYmd || args.toYmd
        ? {
            serviceDate: {
              ...(args.fromYmd ? { gte: bakuCivilUtcDate(args.fromYmd) } : {}),
              ...(args.toYmd ? { lte: bakuCivilUtcDate(args.toYmd) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ serviceDate: "desc" }, { meal: "asc" }, { signedAt: "desc" }],
  });
  return rows.map(serialize);
}

export async function signManagementMeal(input: {
  outletId: string;
  serviceDateYmd: string;
  meal: BuffetMealCode;
  actorLabel: string;
  actorUserId?: string | null;
  signedByUserId?: string | null;
  notes?: string | null;
}) {
  const organizationId = requestOrganizationId();
  const label = input.actorLabel.trim();
  if (!label) {
    throw Object.assign(new Error("ACTOR_REQUIRED"), { code: "ACTOR_REQUIRED" });
  }
  const outlet = await prisma.outlet.findFirst({
    where: { id: input.outletId, organizationId },
    select: { id: true },
  });
  if (!outlet) {
    throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
  }
  const serviceDate = bakuCivilUtcDate(input.serviceDateYmd);
  try {
    const row = await prisma.buffetManagementMeal.create({
      data: {
        organizationId,
        outletId: input.outletId,
        serviceDate,
        meal: input.meal,
        actorLabel: label,
        actorUserId: input.actorUserId ?? null,
        signedByUserId: input.signedByUserId ?? null,
        notes: input.notes?.trim() || null,
      },
    });
    return serialize(row);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw Object.assign(new Error("ALREADY_SIGNED"), { code: "ALREADY_SIGNED" });
    }
    throw err;
  }
}

export async function deleteManagementMeal(id: string) {
  const organizationId = requestOrganizationId();
  const existing = await prisma.buffetManagementMeal.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    throw Object.assign(new Error("MEAL_NOT_FOUND"), { code: "MEAL_NOT_FOUND" });
  }
  await prisma.buffetManagementMeal.delete({ where: { id } });
  return { ok: true as const };
}

export async function countManagementMeals(args: {
  outletId: string;
  serviceDateYmd: string;
  meal: BuffetMealCode;
}) {
  const organizationId = requestOrganizationId();
  return prisma.buffetManagementMeal.count({
    where: {
      organizationId,
      outletId: args.outletId,
      serviceDate: bakuCivilUtcDate(args.serviceDateYmd),
      meal: args.meal,
    },
  });
}
