import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import type { FolioType, HotelLookupKind } from '@prisma/client';
import { roomInventoryWhere } from '@/lib/master-data/retire-policy';
import { HOTEL_LOOKUP_DEFAULTS } from '@/lib/hotel-lookup-defaults';

export async function listRoomTypes() {
  return prisma.roomType.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { rooms: true } } } });
}

export async function createRoomType(input: {
  code: string;
  name: string;
  adultCapacity?: number;
  childCapacity?: number;
  baseQuota: number;
}) {
  return prisma.roomType.create({ data: input });
}

export async function updateRoomType(
  id: string,
  input: {
    name?: string;
    adultCapacity?: number;
    childCapacity?: number;
    baseQuota?: number;
    active?: boolean;
  },
) {
  return prisma.roomType.update({ where: { id }, data: input });
}

export async function listRatePlans() {
  return prisma.ratePlan.findMany({
    include: { roomType: true, mealPlan: true },
    orderBy: { code: 'asc' },
  });
}

export async function createRatePlan(input: {
  code: string;
  name: string;
  pricePerNight: number;
  medicalFlag?: boolean;
  roomTypeId?: string;
  mealPlanId?: string;
  baseOccupancy?: number;
  extraAdultAmount?: number | null;
  thirdAdultAmount?: number | null;
  extraBedAmount?: number | null;
}) {
  return prisma.ratePlan.create({
    data: {
      code: input.code,
      name: input.name,
      medicalFlag: input.medicalFlag,
      roomTypeId: input.roomTypeId,
      mealPlanId: input.mealPlanId,
      pricePerNight: toDecimal(input.pricePerNight),
      baseOccupancy: input.baseOccupancy ?? 1,
      extraAdultAmount:
        input.extraAdultAmount == null ? null : toDecimal(input.extraAdultAmount),
      thirdAdultAmount:
        input.thirdAdultAmount == null ? null : toDecimal(input.thirdAdultAmount),
      extraBedAmount:
        input.extraBedAmount == null ? null : toDecimal(input.extraBedAmount),
    },
    include: { roomType: true, mealPlan: true },
  });
}

export async function updateRatePlan(
  id: string,
  input: {
    name?: string;
    pricePerNight?: number;
    medicalFlag?: boolean;
    roomTypeId?: string | null;
    mealPlanId?: string | null;
    active?: boolean;
    baseOccupancy?: number;
    extraAdultAmount?: number | null;
    thirdAdultAmount?: number | null;
    extraBedAmount?: number | null;
  },
) {
  const data: Record<string, unknown> = {
    name: input.name,
    medicalFlag: input.medicalFlag,
    active: input.active,
    baseOccupancy: input.baseOccupancy,
  };
  if (input.pricePerNight != null) {
    data.pricePerNight = toDecimal(input.pricePerNight);
  }
  if (input.roomTypeId === null) data.roomTypeId = null;
  else if (input.roomTypeId !== undefined) data.roomTypeId = input.roomTypeId;
  if (input.mealPlanId === null) data.mealPlanId = null;
  else if (input.mealPlanId !== undefined) data.mealPlanId = input.mealPlanId;
  if (input.extraAdultAmount !== undefined) {
    data.extraAdultAmount =
      input.extraAdultAmount == null ? null : toDecimal(input.extraAdultAmount);
  }
  if (input.thirdAdultAmount !== undefined) {
    data.thirdAdultAmount =
      input.thirdAdultAmount == null ? null : toDecimal(input.thirdAdultAmount);
  }
  if (input.extraBedAmount !== undefined) {
    data.extraBedAmount =
      input.extraBedAmount == null ? null : toDecimal(input.extraBedAmount);
  }
  // Drop undefined keys so Prisma does not receive them
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }
  return prisma.ratePlan.update({
    where: { id },
    data,
    include: { roomType: true, mealPlan: true },
  });
}

export async function listRevenueCodes() {
  return prisma.revenueCode.findMany({
    include: { department: true, routingRule: true },
    orderBy: { code: 'asc' },
  });
}

export async function createRevenueCode(input: {
  code: string;
  name: string;
  taxTag?: string;
  departmentId?: string;
  targetFolioType?: FolioType;
}) {
  const { targetFolioType, ...codeData } = input;
  return prisma.$transaction(async (tx) => {
    const code = await tx.revenueCode.create({ data: codeData });
    if (targetFolioType) {
      await tx.folioRoutingRule.create({
        data: { revenueCodeId: code.id, targetFolioType },
      });
    }
    return tx.revenueCode.findUnique({
      where: { id: code.id },
      include: { department: true, routingRule: true },
    });
  });
}

export async function updateRevenueCode(
  id: string,
  input: {
    name?: string;
    taxTag?: string | null;
    departmentId?: string | null;
    targetFolioType?: FolioType | null;
    active?: boolean;
  },
) {
  const { targetFolioType, ...codeData } = input;
  return prisma.$transaction(async (tx) => {
    await tx.revenueCode.update({ where: { id }, data: codeData });
    if (targetFolioType !== undefined) {
      if (targetFolioType) {
        await tx.folioRoutingRule.upsert({
          where: { revenueCodeId: id },
          create: { revenueCodeId: id, targetFolioType },
          update: { targetFolioType },
        });
      } else {
        await tx.folioRoutingRule.deleteMany({ where: { revenueCodeId: id } });
      }
    }
    return tx.revenueCode.findUnique({
      where: { id },
      include: { department: true, routingRule: true },
    });
  });
}

export async function listMealPlans() {
  return prisma.mealPlan.findMany({ orderBy: { code: 'asc' } });
}

export async function listDepartments() {
  return prisma.department.findMany({ orderBy: { code: 'asc' } });
}

export async function listBedTypes() {
  return prisma.bedType.findMany({ orderBy: { code: 'asc' } });
}

export async function createBedType(input: { code: string; name: string; systemType?: string }) {
  return prisma.bedType.create({
    data: {
      code: input.code.toUpperCase(),
      name: input.name,
      systemType: input.systemType,
    },
  });
}

export async function updateBedType(
  id: string,
  input: { name?: string; systemType?: string | null; active?: boolean },
) {
  return prisma.bedType.update({ where: { id }, data: input });
}

export async function listRoomViews() {
  return prisma.roomView.findMany({ orderBy: { code: 'asc' } });
}

export async function createRoomView(input: { code: string; name: string }) {
  return prisma.roomView.create({
    data: {
      code: input.code.toUpperCase(),
      name: input.name,
    },
  });
}

export async function updateRoomView(id: string, input: { name?: string; active?: boolean }) {
  return prisma.roomView.update({ where: { id }, data: input });
}

/** Active room types for reservation / pricing pickers. */
export async function listActiveRoomTypes() {
  return prisma.roomType.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
  });
}

/** Active rate plans for new bookings. */
export async function listActiveRatePlans() {
  return prisma.ratePlan.findMany({
    where: { active: true },
    include: { roomType: true, mealPlan: true },
    orderBy: { code: 'asc' },
  });
}

/** Active revenue codes for new folio charges. */
export async function listActiveRevenueCodes() {
  return prisma.revenueCode.findMany({
    where: { active: true },
    include: { department: true, routingRule: true },
    orderBy: { code: 'asc' },
  });
}

/** Idempotent catalog seed when HotelLookup was wiped / never seeded for this org. */
export async function ensureHotelLookupsSeeded() {
  // Product: no Unknown gender in catalog (EW is binary Male/Female + rare Other).
  await prisma.hotelLookup.deleteMany({
    where: { kind: 'GENDER', code: { in: ['UNKNOWN', 'MALE', 'FEMALE'] } },
  });

  const kinds = [...new Set(HOTEL_LOOKUP_DEFAULTS.map((r) => r.kind))] as HotelLookupKind[];
  for (const kind of kinds) {
    const existing = await prisma.hotelLookup.count({ where: { kind } });
    if (existing > 0 && kind !== 'GENDER') continue;
    const rows = HOTEL_LOOKUP_DEFAULTS.filter((r) => r.kind === kind);
    for (const row of rows) {
      const found = await prisma.hotelLookup.findFirst({
        where: { kind: row.kind as HotelLookupKind, code: row.code },
      });
      if (found) {
        if (kind === 'GENDER') {
          await prisma.hotelLookup.update({
            where: { id: found.id },
            data: { name: row.name, sortOrder: row.sortOrder, active: true },
          });
        }
        continue;
      }
      await prisma.hotelLookup.create({
        data: {
          kind: row.kind as HotelLookupKind,
          code: row.code,
          name: row.name,
          sortOrder: row.sortOrder,
        },
      });
    }
  }
}

export async function listHotelLookups(kind?: HotelLookupKind, activeOnly = false) {
  await ensureHotelLookupsSeeded();
  return prisma.hotelLookup.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  });
}

export async function createHotelLookup(input: {
  kind: HotelLookupKind;
  code: string;
  name: string;
  sortOrder?: number;
}) {
  return prisma.hotelLookup.create({
    data: {
      kind: input.kind,
      code: input.code.trim(),
      name: input.name.trim(),
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateHotelLookup(
  id: string,
  input: { name?: string; active?: boolean; sortOrder?: number },
) {
  return prisma.hotelLookup.update({ where: { id }, data: input });
}
