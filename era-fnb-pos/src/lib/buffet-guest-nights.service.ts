import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuCivilUtcDate } from "@era/satellite-kit/time";

const SOURCES = ["MANUAL", "HOTEL", "ESTIMATE"] as const;
export type GuestNightSource = (typeof SOURCES)[number];

function ymdFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function listGuestNights(args: {
  fromYmd: string;
  toYmd: string;
  organizationId?: string;
}) {
  const organizationId = args.organizationId ?? requestOrganizationId();
  if (args.fromYmd > args.toYmd) {
    throw Object.assign(new Error("from must be on or before to"), {
      code: "DATE_ORDER",
    });
  }
  const rows = await prisma.buffetGuestNightEntry.findMany({
    where: {
      organizationId,
      serviceDate: {
        gte: bakuCivilUtcDate(args.fromYmd),
        lte: bakuCivilUtcDate(args.toYmd),
      },
    },
    orderBy: { serviceDate: "asc" },
    select: {
      id: true,
      outletId: true,
      serviceDate: true,
      guestNights: true,
      source: true,
      notes: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    outletId: r.outletId,
    serviceDate: ymdFromDate(r.serviceDate),
    guestNights: r.guestNights,
    source: r.source,
    notes: r.notes,
  }));
}

export async function sumGuestNights(args: {
  fromYmd: string;
  toYmd: string;
  organizationId?: string;
}): Promise<{ total: number; daysWithData: number; entries: Awaited<ReturnType<typeof listGuestNights>> }> {
  const entries = await listGuestNights(args);
  const total = entries.reduce((s, e) => s + e.guestNights, 0);
  return { total, daysWithData: entries.length, entries };
}

export async function getGuestNightsForDate(args: {
  serviceDateYmd: string;
  organizationId?: string;
}) {
  const organizationId = args.organizationId ?? requestOrganizationId();
  const row = await prisma.buffetGuestNightEntry.findUnique({
    where: {
      organizationId_serviceDate: {
        organizationId,
        serviceDate: bakuCivilUtcDate(args.serviceDateYmd),
      },
    },
    select: {
      id: true,
      outletId: true,
      guestNights: true,
      source: true,
      notes: true,
      serviceDate: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    outletId: row.outletId,
    serviceDate: ymdFromDate(row.serviceDate),
    guestNights: row.guestNights,
    source: row.source,
    notes: row.notes,
  };
}

export async function upsertGuestNight(args: {
  serviceDateYmd: string;
  guestNights: number;
  source?: GuestNightSource;
  outletId?: string | null;
  notes?: string | null;
  organizationId?: string;
}) {
  const organizationId = args.organizationId ?? requestOrganizationId();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.serviceDateYmd)) {
    throw Object.assign(new Error("serviceDate must be YYYY-MM-DD"), {
      code: "BAD_DATE",
    });
  }
  const nights = Math.max(0, Math.floor(Number(args.guestNights) || 0));
  const source: GuestNightSource =
    args.source && (SOURCES as readonly string[]).includes(args.source)
      ? args.source
      : "MANUAL";

  if (args.outletId) {
    const outlet = await prisma.outlet.findFirst({
      where: { id: args.outletId, organizationId },
      select: { id: true },
    });
    if (!outlet) {
      throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
    }
  }

  const row = await prisma.buffetGuestNightEntry.upsert({
    where: {
      organizationId_serviceDate: {
        organizationId,
        serviceDate: bakuCivilUtcDate(args.serviceDateYmd),
      },
    },
    create: {
      organizationId,
      serviceDate: bakuCivilUtcDate(args.serviceDateYmd),
      guestNights: nights,
      source,
      outletId: args.outletId ?? null,
      notes: args.notes?.trim() || null,
    },
    update: {
      guestNights: nights,
      source,
      ...(args.outletId !== undefined ? { outletId: args.outletId } : {}),
      ...(args.notes !== undefined ? { notes: args.notes?.trim() || null } : {}),
    },
    select: {
      id: true,
      outletId: true,
      serviceDate: true,
      guestNights: true,
      source: true,
      notes: true,
    },
  });

  return {
    id: row.id,
    outletId: row.outletId,
    serviceDate: ymdFromDate(row.serviceDate),
    guestNights: row.guestNights,
    source: row.source,
    notes: row.notes,
  };
}

export async function deleteGuestNight(args: {
  serviceDateYmd: string;
  organizationId?: string;
}) {
  const organizationId = args.organizationId ?? requestOrganizationId();
  await prisma.buffetGuestNightEntry.deleteMany({
    where: {
      organizationId,
      serviceDate: bakuCivilUtcDate(args.serviceDateYmd),
    },
  });
}

/** Pull hotel occupancy pax into BuffetGuestNightEntry (source HOTEL). */
export async function syncGuestNightsFromHotel(args: {
  fromYmd: string;
  toYmd: string;
  outletId?: string | null;
  organizationId?: string;
}) {
  if (args.fromYmd > args.toYmd) {
    throw Object.assign(new Error("from must be on or before to"), {
      code: "DATE_ORDER",
    });
  }
  const { fetchBuffetGuestNightPax } = await import("@/lib/pms-bridge-client");
  const pack = await fetchBuffetGuestNightPax({
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
    organizationId: args.organizationId,
  });
  if (!pack) {
    throw Object.assign(new Error("Hotel guest-nights unavailable"), {
      code: "HOTEL_UNAVAILABLE",
    });
  }
  const upserted = [];
  for (const day of pack.days) {
    upserted.push(
      await upsertGuestNight({
        serviceDateYmd: day.date,
        guestNights: day.pax,
        source: "HOTEL",
        outletId: args.outletId,
        organizationId: args.organizationId,
      }),
    );
  }
  return { upserted, count: upserted.length };
}
