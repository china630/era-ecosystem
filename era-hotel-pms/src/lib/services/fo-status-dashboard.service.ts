import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { revenueFlashBucket } from '@/lib/services/executive-cockpit.helpers';
import {
  addCivilDays,
  civilDay,
  civilDayCount,
  civilWindow,
  monthStartYmd,
  vatRateFromTag,
} from '@/lib/reports/civil-days';
import {
  buildFoStatus,
  type ChargeSlice,
  type DashStay,
  type FoStatusSnapshot,
  type RoomSlice,
  type StayStatus,
} from '@/lib/services/fo-status-dashboard.math';

const STATUSES: StayStatus[] = ['OPTION', 'CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'];

function chargeKind(
  code: string,
  systemRole: string | null,
  department: string | null,
): ChargeSlice['kind'] {
  const bucket = revenueFlashBucket({ systemRole }, department);
  if (bucket === 'room') return 'room';
  if (bucket === 'fb') {
    // F&B codes are 4xCC: 02 beverages, 03 alcohol. Hotel 1002 is board and stays food.
    if (/^4\d(02|03)$/.test(code.trim())) return 'beverage';
    return 'food';
  }
  return 'other';
}

function nightsOf(inYmd: string, outYmd: string): number {
  if (outYmd <= inYmd) return 1;
  return civilDayCount(inYmd, addCivilDays(outYmd, -1));
}

export async function getFoStatusDashboard(
  organizationId: string,
  day: string,
  options: { includeWaiting: boolean; withRevenue: boolean },
): Promise<FoStatusSnapshot & { reportedAt: string; exchangeRates: { currency: string; exchange: string; buy: string }[] }> {
  const monthStart = monthStartYmd(day);
  const forecastEnd = addCivilDays(day, 8);
  const stayWindow = civilWindow(monthStart, forecastEnd);
  const createdWindow = civilWindow(monthStart, day);

  const [profile, rooms, roomTypes, reservationRows, charges, rates, walkInLookups] = await Promise.all([
    prisma.hotelProfile.findFirst({
      where: { organizationId },
      select: { roomCapacity: true, bedCapacity: true },
    }),
    prisma.room.findMany({
      where: { organizationId, deleted: false, disabled: false },
      select: {
        hkCondition: true,
        inventoryStatus: true,
        status: true,
        roomType: { select: { code: true, baseQuota: true } },
      },
    }),
    prisma.roomType.findMany({
      where: { organizationId, active: true },
      orderBy: { code: 'asc' },
      select: { code: true, name: true, baseQuota: true },
    }),
    prisma.reservation.findMany({
      where: {
        organizationId,
        status: { in: STATUSES },
        OR: [
          { checkInDate: { lt: stayWindow.lt }, checkOutDate: { gte: stayWindow.gte } },
          { createdAt: { gte: createdWindow.gte, lt: createdWindow.lt } },
          { status: 'CANCELLED', updatedAt: { gte: createdWindow.gte, lt: createdWindow.lt } },
        ],
      },
      select: {
        id: true,
        status: true,
        roomId: true,
        roomCount: true,
        checkInDate: true,
        checkOutDate: true,
        createdAt: true,
        updatedAt: true,
        adults: true,
        children11_6: true,
        children5_2: true,
        children1_0: true,
        shareEligible: true,
        shareNo: true,
        walkInProfileCode: true,
        groupId: true,
        accomType: true,
        billingMode: true,
        paymentMethod: true,
        totalAmount: true,
        guestId: true,
        guest: { select: { fullName: true, visitCount: true, birthDate: true } },
        room: { select: { roomNumber: true } },
        roomType: { select: { code: true, name: true } },
        mealPlan: { select: { code: true } },
        source: { select: { name: true } },
        agency: { select: { name: true } },
        company: { select: { name: true } },
        folios: { select: { type: true, status: true } },
      },
    }),
    prisma.folioCharge.findMany({
      where: { organizationId, businessDate: civilWindow(day, day) },
      select: {
        amount: true,
        qty: true,
        revenueCode: {
          select: {
            code: true,
            taxTag: true,
            systemRole: true,
            department: { select: { code: true } },
          },
        },
      },
    }),
    prisma.reservationDailyRate.findMany({
      where: { organizationId, stayDate: { gte: stayWindow.gte, lt: stayWindow.lt } },
      select: { reservationId: true, stayDate: true, amount: true, currencyCode: true },
    }),
    prisma.hotelLookup.findMany({
      where: { organizationId, kind: 'WALKIN_PROFILE' },
      select: { code: true, name: true },
    }),
  ]);

  const physical = rooms.length;
  const capacity = profile?.roomCapacity && profile.roomCapacity > 0 ? profile.roomCapacity : physical;
  const roomsOfType = new Map<string, number>();
  for (const room of rooms) {
    const code = room.roomType.code;
    roomsOfType.set(code, (roomsOfType.get(code) ?? 0) + 1);
  }

  const walkInName = new Map(walkInLookups.map((row) => [row.code, row.name]));
  const stays: DashStay[] = reservationRows.map((row) => {
    const inYmd = civilDay(row.checkInDate);
    const outYmd = civilDay(row.checkOutDate);
    const walkIn = Boolean(row.walkInProfileCode);
    const channel = walkIn
      ? walkInName.get(row.walkInProfileCode ?? '') ?? row.walkInProfileCode ?? 'OTHERS'
      : row.agency?.name || row.company?.name || row.source?.name || 'OTHERS';
    const openFolios = row.folios
      .filter((folio) => folio.status === 'OPEN' || folio.status === 'PENDING_AR')
      .map((folio) => folio.type);
    return {
      id: row.id,
      status: row.status,
      roomId: row.roomId,
      roomNumber: row.room?.roomNumber ?? null,
      roomCount: Math.max(1, row.roomCount ?? 1),
      inYmd,
      outYmd,
      createdYmd: civilDay(row.createdAt),
      updatedYmd: civilDay(row.updatedAt),
      nights: nightsOf(inYmd, outYmd),
      adults: row.adults ?? 0,
      child1: row.children11_6 ?? 0,
      child2: row.children5_2 ?? 0,
      baby: row.children1_0 ?? 0,
      share: row.shareEligible || Boolean(row.shareNo),
      walkIn,
      group: Boolean(row.groupId),
      accomType: row.accomType,
      billingMode: row.billingMode,
      mealCode: row.mealPlan?.code ?? null,
      roomTypeCode: row.roomType.code,
      roomTypeName: row.roomType.name,
      guestId: row.guestId,
      guestName: row.guest.fullName,
      guestVisits: row.guest.visitCount ?? 0,
      birthYmd: row.guest.birthDate ? civilDay(row.guest.birthDate) : null,
      channel,
      folios: openFolios,
      billTo: row.agency ? 'AGENCY' : row.company ? 'COMPANY' : 'GUEST',
      paymentMethod: row.paymentMethod ?? '',
      totalAmount: decimalToNumber(row.totalAmount),
    };
  });

  const roomSlices: RoomSlice[] = rooms.map((room) => ({
    hk: room.hkCondition,
    inventory: room.inventoryStatus,
    status: room.status,
    roomTypeCode: room.roomType.code,
  }));

  const chargeSlices: ChargeSlice[] = charges.map((c) => ({
    kind: chargeKind(
      c.revenueCode.code,
      c.revenueCode.systemRole,
      c.revenueCode.department?.code ?? null,
    ),
    gross: decimalToNumber(c.amount) * (c.qty ?? 1),
    vatRate: vatRateFromTag(c.revenueCode.taxTag),
  }));

  const currencies = new Set<string>(['AZN']);
  for (const rate of rates) currencies.add((rate.currencyCode || 'AZN').toUpperCase());

  const snapshot = buildFoStatus({
    day,
    monthStart,
    mtdDays: civilDayCount(monthStart, day),
    forecastDays: Array.from({ length: 9 }, (_, i) => addCivilDays(day, i)),
    capacity,
    bedCapacity: profile?.bedCapacity ?? null,
    includeWaiting: options.includeWaiting,
    withRevenue: options.withRevenue,
    stays,
    rooms: roomSlices,
    roomTypeQuota: roomTypes.map((rt) => ({
      code: rt.code,
      name: rt.name,
      quota: rt.baseQuota > 0 ? rt.baseQuota : (roomsOfType.get(rt.code) ?? 0),
    })),
    charges: chargeSlices,
    nightRates: rates.map((rate) => ({
      day: civilDay(rate.stayDate),
      reservationId: rate.reservationId,
      amount: decimalToNumber(rate.amount),
    })),
  });

  return {
    ...snapshot,
    reportedAt: new Date().toISOString(),
    exchangeRates: [...currencies].map((currency) =>
      currency === 'AZN'
        ? { currency, exchange: '1.0000', buy: '1.0000' }
        : { currency, exchange: '—', buy: '—' },
    ),
  };
}
