import { prisma } from '@/lib/prisma';
import { getCalendarDaysRange } from '@era/satellite-kit';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { roomWriteFromAxes } from '@/lib/room-state';
import type { HkJobType, HkRosterCellKind, HkVisitOutcome } from '@prisma/client';
import {
  bakuClockHhmm,
  laundryDueAt,
  laundryIntakeBlockReason as laundryWindowBlock,
  neededByBakuToUtc,
} from '@/lib/services/laundry-windows';

export const DEFAULT_FLOOR_PAIRS = [
  [2, 3],
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 11],
] as const;

export function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function ensureFloorPairs() {
  const existing = await prisma.hkFloorPair.findMany({ orderBy: { sortOrder: 'asc' } });
  if (existing.length > 0) return existing;
  const created = [];
  for (let i = 0; i < DEFAULT_FLOOR_PAIRS.length; i++) {
    const [low, high] = DEFAULT_FLOOR_PAIRS[i]!;
    created.push(
      await prisma.hkFloorPair.create({
        data: { sortOrder: i, floorLow: low, floorHigh: high },
      }),
    );
  }
  return created;
}

export async function proposeRosterWeek(weekStartIso: string) {
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`);
  const maids = await prisma.housekeeper.findMany({
    where: { active: true, department: 'ROOMS' },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const existing = await prisma.hkRosterWeek.findFirst({ where: { weekStart } });
  const saved = existing ?? (await prisma.hkRosterWeek.create({ data: { weekStart } }));

  await prisma.hkRosterCell.deleteMany({ where: { weekId: saved.id } });
  for (let i = 0; i < maids.length; i++) {
    const hk = maids[i]!;
    for (let d = 0; d < 7; d++) {
      const workDate = addUtcDays(weekStart, d);
      const offIndex = maids.length === 7 ? d % 7 : i % 7;
      const isOff = maids.length === 7 ? i === offIndex : d === i % 7;
      let kind: HkRosterCellKind = isOff ? 'OFF' : (hk.pinShift && hk.pinShift !== 'OFF' && hk.pinShift !== 'EG' ? hk.pinShift : 'E');
      if (isOff) kind = 'OFF';
      await prisma.hkRosterCell.create({
        data: { weekId: saved.id, housekeeperId: hk.id, workDate, kind },
      });
    }
  }
  return prisma.hkRosterWeek.findUnique({
    where: { id: saved.id },
    include: { cells: { include: { housekeeper: true } } },
  });
}

export async function setRosterCell(cellId: string, kind: HkRosterCellKind, customStart?: string, customEnd?: string) {
  const prev = await prisma.hkRosterCell.findUnique({ where: { id: cellId } });
  if (!prev) throw new Error('Cell not found');
  if (prev.kind === 'EG' && kind !== 'EG') {
    await prisma.housekeeper.update({
      where: { id: prev.housekeeperId },
      data: { egBalance: { increment: 1 } },
    });
    await prisma.hkEgLedger.create({
      data: { housekeeperId: prev.housekeeperId, workDate: prev.workDate, delta: 1, reason: 'unspend-eg' },
    });
  }
  if (kind === 'EG' && prev.kind !== 'EG') {
    const hk = await prisma.housekeeper.findUnique({ where: { id: prev.housekeeperId } });
    if ((hk?.egBalance ?? 0) <= 0) {
      /* warning only — manager may still save */
    }
    await prisma.housekeeper.update({
      where: { id: prev.housekeeperId },
      data: { egBalance: { decrement: 1 } },
    });
    await prisma.hkEgLedger.create({
      data: { housekeeperId: prev.housekeeperId, workDate: prev.workDate, delta: -1, reason: 'spend-eg' },
    });
  }
  return prisma.hkRosterCell.update({
    where: { id: cellId },
    data: { kind, customStart: customStart ?? null, customEnd: customEnd ?? null },
  });
}

export async function accrueEgForDate(workDateIso: string) {
  let days: { date: string; dayType: string }[] = [];
  let calendarUnavailable = false;
  try {
    days = await getCalendarDaysRange(workDateIso, workDateIso);
  } catch (err) {
    calendarUnavailable = true;
    console.warn('HK ƏG calendar unavailable', err);
    days = [];
  }
  if (!days.length && !calendarUnavailable) {
    calendarUnavailable = true;
  }
  const day = days[0];
  const holiday = day && (day.dayType === 'holiday' || day.dayType === 'transferred_rest');
  if (!holiday) return { accrued: 0, calendarUnavailable };
  const cells = await prisma.hkRosterCell.findMany({
    where: {
      workDate: new Date(`${workDateIso}T00:00:00.000Z`),
      kind: { notIn: ['OFF', 'EG'] },
    },
  });
  let accrued = 0;
  for (const c of cells) {
    await prisma.housekeeper.update({
      where: { id: c.housekeeperId },
      data: { egBalance: { increment: 1 } },
    });
    await prisma.hkEgLedger.create({
      data: {
        housekeeperId: c.housekeeperId,
        workDate: c.workDate,
        delta: 1,
        reason: 'holiday-work',
      },
    });
    accrued += 1;
  }
  return { accrued, calendarUnavailable };
}

export async function burnEgBalances(asOfIso: string) {
  const md = asOfIso.slice(5, 10);
  if (md !== '01-01') return { burned: 0 };
  const maids = await prisma.housekeeper.findMany({ where: { egBalance: { gt: 0 } } });
  let burned = 0;
  for (const hk of maids) {
    burned += hk.egBalance;
    await prisma.hkEgLedger.create({
      data: {
        housekeeperId: hk.id,
        workDate: new Date(`${asOfIso}T00:00:00.000Z`),
        delta: -hk.egBalance,
        reason: 'burn-1-jan',
      },
    });
    await prisma.housekeeper.update({ where: { id: hk.id }, data: { egBalance: 0 } });
  }
  return { burned };
}

export async function reorderHousekeepers(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.housekeeper.update({ where: { id }, data: { sortOrder: i } })),
  );
}

export async function moveHousekeeperDepartment(housekeeperId: string, department: 'ROOMS' | 'PUBLIC_AREA' | 'LAUNDRY') {
  return prisma.housekeeper.update({ where: { id: housekeeperId }, data: { department } });
}

export async function swapRotationPairs(rowIdA: string, rowIdB: string) {
  const a = await prisma.hkRotationDay.findUnique({ where: { id: rowIdA } });
  const b = await prisma.hkRotationDay.findUnique({ where: { id: rowIdB } });
  if (!a || !b) throw new Error('Rotation row not found');
  await prisma.$transaction([
    prisma.hkRotationDay.update({ where: { id: a.id }, data: { pairId: b.pairId } }),
    prisma.hkRotationDay.update({ where: { id: b.id }, data: { pairId: a.pairId } }),
  ]);
  return { swapped: true };
}

export function nextPairIndex(yesterdayIndex: number, pairCount: number): number {
  if (pairCount <= 0) return 0;
  return (yesterdayIndex + 1) % pairCount;
}

export function assignedPairsUnique(pairIds: string[]): boolean {
  return new Set(pairIds).size === pairIds.length;
}

export async function rotatePairsForDate(workDateIso: string, shiftKind: HkRosterCellKind = 'E') {
  const pairs = await ensureFloorPairs();
  const workDate = new Date(`${workDateIso}T00:00:00.000Z`);
  const onDuty = await prisma.hkRosterCell.findMany({
    where: {
      workDate,
      kind: { in: ['E', 'L', 'N', 'CUSTOM'] },
      housekeeper: { department: 'ROOMS', active: true },
    },
    include: { housekeeper: true },
    orderBy: { housekeeper: { sortOrder: 'asc' } },
  });
  const yesterday = addUtcDays(workDate, -1);
  const prev = await prisma.hkRotationDay.findMany({
    where: { workDate: yesterday, shiftKind },
    include: { pair: true },
  });
  const pairIds = pairs.map((p) => p.id);
  let start = 0;
  if (prev[0]) {
    const idx = pairIds.indexOf(prev[0].pairId);
    start = nextPairIndex(idx < 0 ? 0 : idx, pairIds.length);
  }
  await prisma.hkRotationDay.deleteMany({ where: { workDate, shiftKind } });
  const used = new Set<string>();
  const assigned = [];
  for (let i = 0; i < onDuty.length; i++) {
    const pair = pairs[(start + i) % pairs.length];
    if (!pair || used.has(pair.id)) continue;
    used.add(pair.id);
    assigned.push(
      await prisma.hkRotationDay.create({
        data: {
          workDate,
          shiftKind,
          housekeeperId: onDuty[i]!.housekeeperId,
          pairId: pair.id,
        },
        include: { pair: true, housekeeper: true },
      }),
    );
  }
  return { assigned, unassignedPairCount: pairs.length - used.size, warning: pairs.length > onDuty.length };
}

function nightsSince(checkIn: Date, onDate: Date): number {
  return Math.max(0, Math.round((onDate.getTime() - checkIn.getTime()) / 86_400_000));
}

export type StayoverDuty = 'DEEP' | 'LINEN' | 'STAY' | 'NONE';

/** Night 0 = arrival day. Deep wins when both cycles land on the same night. */
export function stayoverDuty(nightsInHouse: number, linenEvery: number, deepEvery: number): StayoverDuty {
  if (nightsInHouse <= 0) return 'NONE';
  if (deepEvery > 0 && nightsInHouse % deepEvery === 0) return 'DEEP';
  if (linenEvery > 0 && nightsInHouse % linenEvery === 0) return 'LINEN';
  return 'STAY';
}

export async function getHkHotelPolicy() {
  const existing = await prisma.hkHotelPolicy.findFirst();
  if (existing) return existing;
  return prisma.hkHotelPolicy.create({ data: { linenEveryNights: 3, deepEveryNights: 5 } });
}

export async function saveHkHotelPolicy(
  linenEveryNights: number,
  deepEveryNights: number,
  extra?: {
    laundryExpressEnabled?: boolean;
    laundryExpressPercent?: number | null;
    egPressureFrom?: string | null;
  },
) {
  const row = await getHkHotelPolicy();
  return prisma.hkHotelPolicy.update({
    where: { id: row.id },
    data: {
      linenEveryNights: Math.max(1, Math.min(30, linenEveryNights)),
      deepEveryNights: Math.max(1, Math.min(30, deepEveryNights)),
      ...(extra?.laundryExpressEnabled !== undefined
        ? { laundryExpressEnabled: extra.laundryExpressEnabled }
        : {}),
      ...(extra && 'laundryExpressPercent' in extra
        ? { laundryExpressPercent: extra.laundryExpressPercent }
        : {}),
      ...(extra && 'egPressureFrom' in extra
        ? { egPressureFrom: extra.egPressureFrom ? new Date(`${extra.egPressureFrom}T00:00:00.000Z`) : null }
        : {}),
    },
  });
}

export async function generateFloorSheet(workDateIso: string, floor: number) {
  const workDate = new Date(`${workDateIso}T00:00:00.000Z`);
  const next = addUtcDays(workDate, 1);
  const policy = await getHkHotelPolicy();
  const linenEvery = policy.linenEveryNights;
  const deepEvery = policy.deepEveryNights;
  const rooms = await prisma.room.findMany({
    where: { floor, deleted: false, disabled: false },
    include: {
      roomType: true,
      reservations: {
        where: {
          status: { in: ['CONFIRMED', 'IN_HOUSE'] },
          checkInDate: { lt: next },
          checkOutDate: { gt: workDate },
        },
        include: { guest: true, agency: true, stay: true },
        orderBy: { checkInDate: 'asc' },
      },
    },
    orderBy: { roomNumber: 'asc' },
  });
  const nsr = await prisma.hkNsrDay.findMany({ where: { workDate } });
  const nsrSet = new Set(nsr.map((n) => n.reservationId));
  const dayTasks =
    rooms.length === 0
      ? []
      : await prisma.housekeepingTask.findMany({
          where: { businessDate: workDate, roomId: { in: rooms.map((r) => r.id) } },
        });
  const neededByMap = new Map(dayTasks.map((t) => [t.roomId, t.neededByAt]));
  const rotation = await prisma.hkRotationDay.findMany({
    where: { workDate },
    include: { housekeeper: true, pair: true },
  });
  const maid = rotation.find((r) => floor >= r.pair.floorLow && floor <= r.pair.floorHigh);

  const rows = rooms.map((room) => {
    const stay = room.reservations.find((r) => r.status === 'IN_HOUSE') ?? room.reservations[0];
    const co = stay ? isoDay(stay.checkOutDate) : '';
    const ci = stay ? isoDay(stay.checkInDate) : '';
    let jobType: HkJobType = 'OTHER';
    let jobDuty: StayoverDuty | 'DEPARTURE' | 'ARRIVAL_PREP' | 'NSR' | 'OTHER' = 'OTHER';
    if (stay && nsrSet.has(stay.id)) {
      jobType = 'NSR';
      jobDuty = 'NSR';
    } else if (stay && co === workDateIso) {
      jobType = 'DEPARTURE';
      jobDuty = 'DEPARTURE';
    } else if (stay?.status === 'IN_HOUSE') {
      jobType = 'STAYOVER';
      jobDuty = stayoverDuty(
        nightsSince(stay.checkInDate, workDate),
        stay.linenEveryNights ?? linenEvery,
        stay.deepEveryNights ?? deepEvery,
      );
    } else if ((room.hkCondition === 'DIRTY' || room.status === 'DIRTY') && !stay) {
      jobType = 'ARRIVAL_PREP';
      jobDuty = 'ARRIVAL_PREP';
    }
    const todayArrival = stay && ci === workDateIso;
    const todayDepart = stay && co === workDateIso;
    const occupied = stay?.status === 'IN_HOUSE';
    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      hkCondition: room.hkCondition,
      inventoryStatus: room.inventoryStatus,
      occupancy: occupied ? 'OCC' : 'AVL',
      status: room.status,
      roomType: room.roomType.code,
      floor: room.floor,
      location: room.location ?? '',
      guests: stay?.guest.fullName ?? '',
      nationality: stay?.guest.nationality ?? '',
      vip: stay?.guest.vipType ?? stay?.vipType ?? '',
      agency: stay?.agency?.name ?? '',
      arrival: ci,
      arrivalTime: stay?.stay?.actualCheckIn ? bakuClockHhmm(stay.stay.actualCheckIn) : '',
      departure: co,
      lateCheckout: stay?.stay?.actualCheckOut ? bakuClockHhmm(stay.stay.actualCheckOut) : '',
      extraPax: stay?.extraBeds ?? 0,
      adults: stay?.adults ?? 0,
      children: (stay?.children11_6 ?? 0) + (stay?.children5_2 ?? 0) + (stay?.children1_0 ?? 0),
      repeat: 0,
      todayArrivalPax: todayArrival ? stay?.adults ?? 0 : 0,
      todayArrivalTime: todayArrival && stay?.stay?.actualCheckIn ? bakuClockHhmm(stay.stay.actualCheckIn) : '',
      todayDepartPax: todayDepart ? stay?.adults ?? 0 : 0,
      todayDepartTime: todayDepart && stay?.stay?.actualCheckOut ? bakuClockHhmm(stay.stay.actualCheckOut) : '',
      qHour: '',
      jobType,
      jobDuty,
      nightsInHouse: stay?.status === 'IN_HOUSE' ? nightsSince(stay.checkInDate, workDate) : 0,
      linenEvery: stay?.linenEveryNights ?? linenEvery,
      deepEvery: stay?.deepEveryNights ?? deepEvery,
      visitOutcome: '',
      visitTime: '',
      neededByAt: neededByMap.get(room.id)?.toISOString() ?? null,
      maidName: maid?.housekeeper.name ?? '',
      maidChef: '',
      reservationId: stay?.id ?? null,
    };
  });
  const rank = (duty: string) =>
    duty === 'DEPARTURE' ? 0 : duty === 'DEEP' ? 1 : duty === 'LINEN' ? 2 : duty === 'ARRIVAL_PREP' ? 3 : 4;
  return rows.sort((a, b) => {
    if (a.jobDuty === 'DEPARTURE' && b.jobDuty !== 'DEPARTURE') return -1;
    if (b.jobDuty === 'DEPARTURE' && a.jobDuty !== 'DEPARTURE') return 1;
    const vip = Number(Boolean(b.vip)) - Number(Boolean(a.vip));
    if (vip !== 0) return vip;
    const na = a.neededByAt ? new Date(a.neededByAt).getTime() : Number.POSITIVE_INFINITY;
    const nb = b.neededByAt ? new Date(b.neededByAt).getTime() : Number.POSITIVE_INFINITY;
    if (na !== nb) return na - nb;
    const dirty = Number(b.hkCondition === 'DIRTY') - Number(a.hkCondition === 'DIRTY');
    if (dirty !== 0) return dirty;
    return rank(String(a.jobDuty)) - rank(String(b.jobDuty));
  });
}

export async function generateAllFloorSheets(workDateIso: string) {
  const floors = await prisma.room.findMany({
    where: { deleted: false, disabled: false },
    select: { floor: true },
    distinct: ['floor'],
    orderBy: { floor: 'asc' },
  });
  const pages = [];
  for (const f of floors) {
    pages.push({ floor: f.floor, rows: await generateFloorSheet(workDateIso, f.floor) });
  }
  return pages;
}

export async function generateFloorSheetPdf(workDateIso: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const pages = await generateAllFloorSheets(workDateIso);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.fontSize(12).text(`Floor sheet ${workDateIso}`, { align: 'left' });
  for (const page of pages) {
    doc.moveDown();
    doc.fontSize(10).text(`Floor ${page.floor}`);
    for (const row of page.rows) {
      const r = row as Record<string, unknown>;
      doc
        .fontSize(8)
        .text(
          `${r.roomNumber ?? ''} ${r.occupancy ?? ''} ${r.guests ?? ''} ${r.arrivalTime ?? ''} ${r.departureTime ?? ''} ${r.jobDuty ?? ''}`,
        );
    }
  }
  doc.end();
  return done;
}

export async function applySheetOutcome(roomId: string, workDateIso: string, outcome: HkVisitOutcome) {
  const workDate = new Date(`${workDateIso}T00:00:00.000Z`);
  let task = await prisma.housekeepingTask.findFirst({
    where: { roomId, businessDate: workDate, status: { not: 'DONE' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!task) {
    task = await prisma.housekeepingTask.create({
      data: { roomId, businessDate: workDate, jobType: 'OTHER', status: 'PENDING' },
    });
  }
  if (!task) throw new Error('Task missing');
  return applyVisitOutcome(task.id, outcome);
}

export async function applyVisitOutcome(taskId: string, outcome: HkVisitOutcome) {
  const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');
  const room = await prisma.room.findUnique({ where: { id: task.roomId } });
  if (!room) throw new Error('Room not found');
  const inv = room.inventoryStatus === 'OOO' || room.inventoryStatus === 'OOS' ? room.inventoryStatus : 'IN_SERVICE';
  let hk = room.hkCondition;
  let done = false;
  if (outcome === 'V' || outcome === 'VC') {
    hk = 'CLEAN';
    done = true;
  } else if (outcome === 'OK') {
    hk = 'CLEAN';
    done = true;
  }
  await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: {
      visitOutcome: outcome,
      status: done ? 'DONE' : 'IN_PROGRESS',
      jobType: outcome === 'REFUSED' ? 'NSR' : task.jobType,
    },
  });
  if (done) {
    await prisma.room.update({
      where: { id: room.id },
      data: roomWriteFromAxes(hk, inv, room.inventoryReason),
    });
  }
  return { outcome, done };
}

export async function setNeededByAt(roomId: string, workDateIso: string, hhmm: string) {
  const workDate = new Date(`${workDateIso}T00:00:00.000Z`);
  const [hh, mm] = hhmm.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) throw new Error('Invalid time');
  const neededByAt = neededByBakuToUtc(
    workDateIso,
    `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
  );
  let task = await prisma.housekeepingTask.findFirst({
    where: { roomId, businessDate: workDate, status: { not: 'DONE' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!task) {
    task = await prisma.housekeepingTask.create({
      data: { roomId, businessDate: workDate, jobType: 'OTHER', status: 'PENDING', neededByAt },
    });
  } else {
    task = await prisma.housekeepingTask.update({
      where: { id: task.id },
      data: { neededByAt },
    });
  }
  return task;
}

export async function escalateVisitFlags(workDateIso: string) {
  const workDate = new Date(`${workDateIso}T00:00:00.000Z`);
  const tasks = await prisma.housekeepingTask.findMany({
    where: { visitOutcome: { in: ['DND', 'SO'] } },
    include: { room: true },
  });
  const fo: Array<{ roomNumber: string; kind: string; days: number; roomId: string }> = [];
  for (const t of tasks) {
    const streak = await prisma.housekeepingTask.count({
      where: {
        roomId: t.roomId,
        visitOutcome: t.visitOutcome,
        businessDate: { lte: workDate },
      },
    });
    if (t.visitOutcome === 'DND' && streak >= 2) fo.push({ roomNumber: t.room.roomNumber, kind: 'DND', days: streak, roomId: t.roomId });
    if (t.visitOutcome === 'SO' && streak >= 3) fo.push({ roomNumber: t.room.roomNumber, kind: 'SO', days: streak, roomId: t.roomId });
  }
  for (const row of fo) {
    const stay = await prisma.reservation.findFirst({
      where: { roomId: row.roomId, status: 'IN_HOUSE' },
      select: { guestId: true },
    });
    if (!stay) continue;
    const title = row.kind === 'DND' ? `FO DND ${row.days}d room ${row.roomNumber}` : `FO SO ${row.days}d room ${row.roomNumber}`;
    const existing = await prisma.guestTask.findFirst({ where: { guestId: stay.guestId, title, status: 'OPEN' } });
    if (!existing) {
      await prisma.guestTask.create({ data: { guestId: stay.guestId, title, status: 'OPEN' } });
    }
  }
  return fo;
}

export async function recordDiscrepancy(roomId: string, workDateIso: string, kind: 'SKIP' | 'SLEEP', notes?: string) {
  return prisma.hkDiscrepancy.create({
    data: {
      roomId,
      workDate: new Date(`${workDateIso}T00:00:00.000Z`),
      kind,
      notes: notes ?? null,
    },
  });
}

export function laundryLineAmount(
  washQty: number,
  ironQty: number,
  washPrice: number,
  ironPrice: number,
  express = false,
  surchargePercent?: number | null,
) {
  const base = washQty * washPrice + ironQty * ironPrice;
  if (express && surchargePercent && surchargePercent > 0) {
    return Math.round(base * (1 + surchargePercent / 100) * 100) / 100;
  }
  return Math.round(base * 100) / 100;
}

export function laundryIntakeBlockReason(input: {
  now: Date;
  express: boolean;
  hasWash?: boolean;
  hasIron?: boolean;
  expressEnabled?: boolean;
  dayType?: string | null;
  calendarUnavailable?: boolean;
}): string | null {
  const hasWash = input.hasWash ?? true;
  const hasIron = input.hasIron ?? false;
  return laundryWindowBlock({
    now: input.now,
    hasWash,
    hasIron,
    express: input.express,
    expressEnabled: input.expressEnabled,
    dayType: input.dayType,
  });
}

export async function resolveStayForRoom(roomId: string) {
  const inHouse = await prisma.reservation.findFirst({
    where: { roomId, status: 'IN_HOUSE' },
    include: { guest: true },
  });
  if (inHouse) return inHouse;
  const today = isoDay(new Date());
  const start = new Date(`${today}T00:00:00.000Z`);
  const end = addUtcDays(start, 1);
  return prisma.reservation.findFirst({
    where: {
      roomId,
      status: 'CONFIRMED',
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    include: { guest: true },
  });
}

export async function createLaundryTicket(input: {
  roomId: string;
  reservationId?: string;
  guestName?: string;
  express?: boolean;
  now?: Date;
  lines: Array<{ itemId: string; washQty: number; ironQty: number; guestQty?: number; hotelQty?: number }>;
}) {
  const now = input.now ?? new Date();
  const policy = await getHkHotelPolicy();
  const stay = input.reservationId
    ? await prisma.reservation.findUnique({ where: { id: input.reservationId }, include: { guest: true } })
    : await resolveStayForRoom(input.roomId);
  if (!stay) throw new Error('In-house or arriving reservation required');
  const hasWash = input.lines.some((l) => l.washQty > 0);
  const hasIron = input.lines.some((l) => l.ironQty > 0);
  let dayType: string | null = null;
  try {
    const days = await getCalendarDaysRange(isoDay(now), isoDay(now));
    dayType = days[0]?.dayType ?? null;
  } catch {
    dayType = null;
  }
  const blocked = laundryWindowBlock({
    now,
    hasWash,
    hasIron,
    express: input.express ?? false,
    expressEnabled: policy.laundryExpressEnabled,
    dayType,
  });
  if (blocked) throw new Error(blocked);
  if (input.express && (policy.laundryExpressPercent == null || policy.laundryExpressPercent <= 0)) {
    throw new Error('Express surcharge is not configured');
  }
  const dueAt = laundryDueAt(now);
  return prisma.laundryTicket.create({
    data: {
      roomId: input.roomId,
      reservationId: stay.id,
      guestName: input.guestName || stay.guest.fullName,
      express: input.express ?? false,
      status: 'IN_PLANT',
      dueAt,
      lines: {
        create: input.lines
          .filter((l) => l.washQty > 0 || l.ironQty > 0)
          .map((l) => ({
            itemId: l.itemId,
            washQty: l.washQty,
            ironQty: l.ironQty,
            guestQty: l.guestQty ?? l.washQty + l.ironQty,
            hotelQty: l.hotelQty ?? l.washQty + l.ironQty,
          })),
      },
    },
    include: { lines: true },
  });
}

export async function deliverLaundryTicket(input: {
  ticketId: string;
  actorUserId: string;
  actorRole: 'HK' | 'FO';
  returnScanKey: string;
  now?: Date;
}) {
  if (!input.returnScanKey.trim()) {
    const err = new Error('Return form scan is required');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  const ticket = await prisma.laundryTicket.findUnique({
    where: { id: input.ticketId },
    include: { lines: { include: { item: true } } },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.status === 'POSTED') return ticket;
  if (ticket.status === 'VOIDED') throw new Error('Ticket is voided');
  const policy = await getHkHotelPolicy();
  const now = input.now ?? new Date();
  let reservationId = ticket.reservationId;
  if (!reservationId) {
    const stay = await resolveStayForRoom(ticket.roomId);
    if (!stay) throw new Error('Reservation required');
    reservationId = stay.id;
  }
  let total = 0;
  let qty = 0;
  const summary: string[] = [];
  for (const line of ticket.lines) {
    const wash = line.washQty;
    const iron = line.ironQty;
    qty += wash + iron;
    const amt = laundryLineAmount(
      wash,
      iron,
      decimalToNumber(line.item.washPrice),
      decimalToNumber(line.item.ironPrice),
      ticket.express,
      policy.laundryExpressPercent,
    );
    total += amt;
    if (wash || iron) summary.push(`${line.item.code} W${wash}/I${iron}`);
    await prisma.laundryTicketLine.update({
      where: { id: line.id },
      data: { amount: toDecimal(amt) },
    });
  }
  const rev = await prisma.revenueCode.findFirst({ where: { code: 'LAUNDRY' } });
  if (!rev) throw new Error('LAUNDRY revenue code missing');
  const dept =
    (await prisma.department.findFirst({ where: { code: 'LAUNDRY' } })) ??
    (await prisma.department.findFirst({ where: { code: 'HK' } }));
  const charge = await postCharge({
    reservationId,
    revenueCodeId: rev.id,
    amount: total,
    qty: Math.max(1, qty),
    departmentId: dept?.id,
    businessDate: new Date(`${isoDay(now)}T00:00:00.000Z`),
    description: `Laundry ${ticket.express ? 'express' : 'regular'} ticket ${ticket.id.slice(0, 8)} ${summary.join(', ')}`,
  });
  return prisma.laundryTicket.update({
    where: { id: ticket.id },
    data: {
      status: 'POSTED',
      total: toDecimal(total),
      folioChargeId: charge.id,
      reservationId,
      postedAt: now,
      postedByUserId: input.actorUserId,
      postedByRole: input.actorRole,
      returnScanKey: input.returnScanKey,
    },
  });
}

export async function postLaundryTicket(ticketId: string, now = new Date()) {
  void now;
  throw new Error('Laundry posts only on Delivered — use deliverLaundryTicket');
}

export async function voidLaundryForCharge(chargeId: string) {
  const ticket = await prisma.laundryTicket.findFirst({ where: { folioChargeId: chargeId } });
  if (!ticket) return null;
  return prisma.laundryTicket.update({
    where: { id: ticket.id },
    data: { status: 'VOIDED', folioChargeId: null },
  });
}

export class LaundryOpenError extends Error {
  status = 409;
  code = 'LAUNDRY_OPEN' as const;
  tickets: Array<{ id: string; guestName: string; dueAt: Date | null }>;
  constructor(tickets: Array<{ id: string; guestName: string; dueAt: Date | null }>) {
    super('Open laundry tickets block check-out');
    this.tickets = tickets;
  }
}

export async function assertNoOpenLaundry(reservationId: string) {
  const open = await prisma.laundryTicket.findMany({
    where: { reservationId, status: 'IN_PLANT' },
    select: { id: true, guestName: true, dueAt: true },
  });
  if (open.length > 0) throw new LaundryOpenError(open);
}

export async function saveStayLinenOverride(
  reservationId: string,
  linenEveryNights: number | null,
  deepEveryNights: number | null,
) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { linenEveryNights, deepEveryNights },
  });
}

export const NAFTA_LAUNDRY_CATALOG: Array<{
  code: string;
  name: string;
  category: string;
  washPrice: number;
  ironPrice: number;
}> = [
  { code: 'M-TROUSERS', name: 'Men trousers', category: 'MEN', washPrice: 4, ironPrice: 3 },
  { code: 'M-SHIRT', name: 'Men shirt', category: 'MEN', washPrice: 4, ironPrice: 3 },
  { code: 'M-TEE', name: 'Men T-shirt', category: 'MEN', washPrice: 3, ironPrice: 2 },
  { code: 'M-SOCKS', name: 'Men socks', category: 'MEN', washPrice: 0.5, ironPrice: 0 },
  { code: 'W-SKIRT', name: 'Women skirt', category: 'WOMEN', washPrice: 5, ironPrice: 3 },
  { code: 'W-DRESS', name: 'Women dress', category: 'WOMEN', washPrice: 10, ironPrice: 5 },
  { code: 'W-TEE', name: 'Women T-shirt', category: 'WOMEN', washPrice: 3, ironPrice: 2 },
  { code: 'C-TROUSERS', name: 'Child trousers', category: 'CHILD', washPrice: 2, ironPrice: 1 },
  { code: 'C-SOCKS', name: 'Child socks', category: 'CHILD', washPrice: 0.5, ironPrice: 0 },
];

export async function ensureNaftaLaundryCatalog() {
  for (const row of NAFTA_LAUNDRY_CATALOG) {
    const existing = await prisma.laundryItem.findFirst({ where: { code: row.code } });
    if (existing) {
      await prisma.laundryItem.update({
        where: { id: existing.id },
        data: {
          washPrice: toDecimal(row.washPrice),
          ironPrice: toDecimal(row.ironPrice),
          name: row.name,
          category: row.category,
          active: true,
        },
      });
    } else {
      await prisma.laundryItem.create({
        data: {
          code: row.code,
          name: row.name,
          category: row.category,
          washPrice: toDecimal(row.washPrice),
          ironPrice: toDecimal(row.ironPrice),
          active: true,
        },
      });
    }
  }
}

async function orgId(): Promise<string> {
  const first = await prisma.laundryItem.findFirst({ select: { organizationId: true } });
  if (first) return first.organizationId;
  const hk = await prisma.hkHotelPolicy.findFirst({ select: { organizationId: true } });
  return hk?.organizationId ?? 'default';
}

export function inventoryOooCount(rooms: { inventoryStatus?: string | null; status?: string | null }[]) {
  return rooms.filter((r) => r.inventoryStatus === 'OOO' || (!r.inventoryStatus && r.status === 'OOO')).length;
}

export function inventoryOosCount(rooms: { inventoryStatus?: string | null; status?: string | null }[]) {
  return rooms.filter((r) => r.inventoryStatus === 'OOS' || (!r.inventoryStatus && r.status === 'OOS')).length;
}

export async function hkLoadForecast(fromIso: string, days: number) {
  const horizon = days === 7 ? 7 : 14;
  const from = new Date(`${fromIso}T00:00:00.000Z`);
  const to = addUtcDays(from, horizon);
  const rooms = await prisma.room.findMany({
    where: { deleted: false, disabled: false },
    select: { id: true, floor: true },
  });
  const stays = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE'] },
      checkInDate: { lt: to },
      checkOutDate: { gt: from },
    },
    select: {
      roomId: true,
      checkInDate: true,
      checkOutDate: true,
      vipType: true,
      linenEveryNights: true,
      deepEveryNights: true,
      guest: { select: { vipType: true } },
    },
  });
  const nsr = await prisma.hkNsrDay.findMany({
    where: { workDate: { gte: from, lt: to } },
  });
  const byFloor = new Map<
    number,
    {
      floor: number;
      departures: number;
      arrivals: number;
      stayovers: number;
      linen: number;
      deep: number;
      nsr: number;
      vip: number;
      headsOnDuty: number;
    }
  >();
  const policy = await getHkHotelPolicy();
  for (const r of rooms) {
    if (!byFloor.has(r.floor)) {
      byFloor.set(r.floor, {
        floor: r.floor,
        departures: 0,
        arrivals: 0,
        stayovers: 0,
        linen: 0,
        deep: 0,
        nsr: 0,
        vip: 0,
        headsOnDuty: 0,
      });
    }
  }
  for (let i = 0; i < horizon; i++) {
    const day = addUtcDays(from, i);
    const key = isoDay(day);
    const rotation = await prisma.hkRotationDay.findMany({
      where: { workDate: day },
      include: { pair: true },
    });
    for (const rot of rotation) {
      for (let f = rot.pair.floorLow; f <= rot.pair.floorHigh; f++) {
        const row = byFloor.get(f);
        if (row) row.headsOnDuty += 1;
      }
    }
    for (const s of stays) {
      const room = rooms.find((r) => r.id === s.roomId);
      if (!room) continue;
      const row = byFloor.get(room.floor)!;
      const ci = isoDay(s.checkInDate);
      const co = isoDay(s.checkOutDate);
      if (co === key) row.departures += 1;
      else if (ci === key) row.arrivals += 1;
      else if (ci < key && co > key) {
        row.stayovers += 1;
        const duty = stayoverDuty(
          nightsSince(s.checkInDate, day),
          s.linenEveryNights ?? policy.linenEveryNights,
          s.deepEveryNights ?? policy.deepEveryNights,
        );
        if (duty === 'LINEN') row.linen += 1;
        if (duty === 'DEEP') row.deep += 1;
      }
      if ((s.vipType || s.guest.vipType) && ci <= key && co > key) row.vip += 1;
    }
    for (const n of nsr) {
      if (isoDay(n.workDate) !== key) continue;
      const room = rooms.find((r) => r.id === n.roomId);
      if (!room) continue;
      byFloor.get(room.floor)!.nsr += 1;
    }
  }
  return { from: fromIso, days: horizon, floors: [...byFloor.values()].sort((a, b) => a.floor - b.floor) };
}

