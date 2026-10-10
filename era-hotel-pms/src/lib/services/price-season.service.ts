import { prisma } from "@/lib/prisma";
import { recordHotelAudit } from "@/lib/satellite-audit";
import { seasonDateKey, seasonRangesOverlap } from "@/lib/pricing/price-season";

const DEFAULTS = [
  { code: "HIGH", name: "High season", startsOn: "2026-05-01", endsOn: "2026-10-31", sortOrder: 1 },
  { code: "LOW", name: "Low season", startsOn: "2026-11-01", endsOn: "2027-04-30", sortOrder: 2 },
] as const;

function asUtcDate(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
}

export async function listPriceSeasons() {
  const existing = await prisma.priceSeason.findMany({ orderBy: { sortOrder: "asc" } });
  if (existing.length > 0) return existing;
  await prisma.priceSeason.createMany({
    data: DEFAULTS.map((row) => ({
      code: row.code,
      name: row.name,
      startsOn: asUtcDate(row.startsOn),
      endsOn: asUtcDate(row.endsOn),
      sortOrder: row.sortOrder,
    })),
  });
  return prisma.priceSeason.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function updatePriceSeason(
  id: string,
  input: { name?: string; startsOn: string; endsOn: string },
  userId?: string | null,
) {
  const startsOn = input.startsOn.slice(0, 10);
  const endsOn = input.endsOn.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    throw new Error("Season dates must be YYYY-MM-DD");
  }
  if (startsOn > endsOn) throw new Error("Season start is after its end");

  const current = await prisma.priceSeason.findUnique({ where: { id } });
  if (!current) throw new Error("Season not found");

  const others = await prisma.priceSeason.findMany({
    where: { organizationId: current.organizationId, id: { not: id } },
  });
  for (const other of others) {
    if (
      seasonRangesOverlap(
        { startsOn, endsOn },
        { startsOn: seasonDateKey(other.startsOn), endsOn: seasonDateKey(other.endsOn) },
      )
    ) {
      throw new Error(`Season overlaps ${other.code}`);
    }
  }

  const from = asUtcDate(startsOn);
  const to = asUtcDate(endsOn);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.priceSeason.update({
      where: { id },
      data: {
        name: input.name?.trim() || current.name,
        startsOn: from,
        endsOn: to,
      },
    });
    await tx.ratePlanSellVersion.updateMany({
      where: { seasonId: id },
      data: { effectiveFrom: from, effectiveTo: to },
    });
    return row;
  });

  await recordHotelAudit({ userId }, "PriceSeason", id, "UPDATE", {
    code: updated.code,
    startsOn,
    endsOn,
  });
  return updated;
}
