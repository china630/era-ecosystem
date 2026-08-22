import { prisma } from '@/lib/prisma';

export interface DailyManagementData {
  businessDate: string;
  roomStats: {
    totalRooms: number;
    occupied: number;
    vacant: number;
    ooo: number;
    oos: number;
    complimentary: number;
    houseUse: number;
    occupancyPct: number;
    avgRate: number;
    revPar: number;
  };
  revenueSummary: { departmentCode: string; departmentName: string; total: number }[];
  arrivals: number;
  departures: number;
  inHouseGuests: number;
}

export async function queryDailyManagement(businessDate: Date): Promise<DailyManagementData> {
  const dateIso = businessDate.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateIso}T23:59:59.999Z`);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const [rooms, reservations, charges, profile] = await Promise.all([
    prisma.room.findMany({
      where: { deleted: false, disabled: false },
      select: { id: true, status: true, inventoryStatus: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: nextDay },
        checkOutDate: { gt: dayStart },
      },
      select: {
        id: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        totalAmount: true,
        ratePlan: { select: { pricePerNight: true } },
        paymentMethod: true,
        accomType: true,
      },
    }),
    prisma.folioCharge.findMany({
      where: { businessDate: dayStart },
      select: {
        amount: true,
        departmentId: true,
        department: { select: { code: true, name: true } },
        revenueCode: { select: { code: true, department: { select: { code: true, name: true } } } },
      },
    }),
    prisma.hotelProfile.findFirst({ select: { roomCapacity: true } }),
  ]);

  const totalRooms = profile?.roomCapacity ?? rooms.length;
  const ooo = rooms.filter((r) => r.inventoryStatus === 'OOO' || (!r.inventoryStatus && r.status === 'OOO')).length;
  const oos = rooms.filter((r) => r.inventoryStatus === 'OOS' || (!r.inventoryStatus && r.status === 'OOS')).length;

  const inHouseRes = reservations.filter(
    (r) => r.status === 'IN_HOUSE' || (r.checkInDate <= dayStart && r.checkOutDate > dayStart),
  );
  const occupied = inHouseRes.length;
  const complimentary = inHouseRes.filter((r) => r.accomType === 'COMP').length;
  const houseUse = inHouseRes.filter((r) => r.accomType === 'HOUSE').length;

  const sellableRooms = totalRooms - ooo;
  const vacant = Math.max(sellableRooms - occupied, 0);
  const occupancyPct = sellableRooms > 0 ? Math.round((occupied / sellableRooms) * 1000) / 10 : 0;

  const roomRevenue = charges
    .filter((c) => {
      const deptCode = c.department?.code ?? c.revenueCode?.department?.code;
      return deptCode === 'ROOM' || deptCode === 'ROOMS';
    })
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const avgRate = occupied > 0 ? Math.round((roomRevenue / occupied) * 100) / 100 : 0;
  const revPar = sellableRooms > 0 ? Math.round((roomRevenue / sellableRooms) * 100) / 100 : 0;

  const deptMap = new Map<string, { departmentCode: string; departmentName: string; total: number }>();
  for (const c of charges) {
    const dept = c.department ?? c.revenueCode?.department;
    const departmentCode = dept?.code ?? 'OTHER';
    const departmentName = dept?.name ?? 'Other';
    const existing = deptMap.get(departmentCode);
    if (existing) {
      existing.total += Number(c.amount);
    } else {
      deptMap.set(departmentCode, { departmentCode, departmentName, total: Number(c.amount) });
    }
  }
  const revenueSummary = [...deptMap.values()].sort((a, b) => b.total - a.total);

  const arrivals = reservations.filter((r) => {
    const ci = r.checkInDate.toISOString().slice(0, 10);
    return ci === dateIso;
  }).length;

  const departures = reservations.filter((r) => {
    const co = r.checkOutDate.toISOString().slice(0, 10);
    return co === dateIso;
  }).length;

  return {
    businessDate: dateIso,
    roomStats: {
      totalRooms,
      occupied,
      vacant,
      ooo,
      oos,
      complimentary,
      houseUse,
      occupancyPct,
      avgRate,
      revPar,
    },
    revenueSummary,
    arrivals,
    departures,
    inHouseGuests: occupied,
  };
}
