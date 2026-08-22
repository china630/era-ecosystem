import { prisma } from '@/lib/prisma';
import { getCalendarDaysRange } from '@era/satellite-kit';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { roomWriteFromAxes } from '@/lib/room-state';
import type { HkJobType, HkRosterCellKind, HkVisitOutcome } from '@prisma/client';

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
  return assigned;
}

function nightsSince(checkIn: Date, onDate: Date): number {
  return Math.max(0, Math.round((onDate.getTime() - checkIn.getTime()) / 86_400_000));
}

export async function generateFloorSheet(workDateIso: string, floor: number) {
  const workDate = new Date(`${workDateIso}T00:00:00.000Z`);
  const next = addUtcDays(workDate, 1);
  const policy = await prisma.hkHotelPolicy.findFirst();
  const linenEvery = policy?.linenEveryNights ?? 3;
  const deepEvery = policy?.deepEveryNights ?? 5;
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
        include: { guest: true, agency: true },
        orderBy: { checkInDate: 'asc' },
      },
    },
    orderBy: { roomNumber: 'asc' },
  });
  const nsr = await prisma.hkNsrDay.findMany({ where: { workDate } });
  const nsrSet = new Set(nsr.map((n) => n.reservationId));
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
    if (stay && nsrSet.has(stay.id)) jobType = 'NSR';
    else if (stay && co === workDateIso) jobType = 'DEPARTURE';
    else if (stay?.status === 'IN_HOUSE') {
      const n = nightsSince(stay.checkInDate, workDate);
      if (deepEvery > 0 && n > 0 && n % deepEvery === 0) jobType = 'STAYOVER';
      else if (linenEvery > 0 && n > 0 && n % linenEvery === 0) jobType = 'STAYOVER';
      else jobType = 'STAYOVER';
    } else if ((room.hkCondition === 'DIRTY' || room.status === 'DIRTY') && !stay) {
      jobType = 'ARRIVAL_PREP';
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
      arrivalTime: '',
      departure: co,
      lateCheckout: '',
      extraPax: 0,
      adults: stay?.adults ?? 0,
      children: (stay?.children11_6 ?? 0) + (stay?.children5_2 ?? 0) + (stay?.children1_0 ?? 0),
      repeat: 0,
      todayArrivalPax: todayArrival ? stay?.adults ?? 0 : 0,
      todayArrivalTime: '',
      todayDepartPax: todayDepart ? stay?.adults ?? 0 : 0,
      todayDepartTime: '',
      qHour: '',
      jobType,
      visitOutcome: '',
      visitTime: '',
      maidName: maid?.housekeeper.name ?? '',
      maidChef: '',
      reservationId: stay?.id ?? null,
    };
  });
  const rank = (j: HkJobType) =>
    j === 'DEPARTURE' ? 0 : j === 'ARRIVAL_PREP' ? 2 : j === 'STAYOVER' ? 3 : 4;
  return rows.sort((a, b) => {
    if (a.jobType === 'DEPARTURE' && b.jobType !== 'DEPARTURE') return -1;
    if (b.jobType === 'DEPARTURE' && a.jobType !== 'DEPARTURE') return 1;
    const vip = Number(Boolean(b.vip)) - Number(Boolean(a.vip));
    if (vip !== 0) return vip;
    const dirty = Number(b.hkCondition === 'DIRTY') - Number(a.hkCondition === 'DIRTY');
    if (dirty !== 0) return dirty;
    return rank(a.jobType) - rank(b.jobType);
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

export async function escalateVisitFlags(workDateIso: string) {
  const workDate = new Date(`${workDateIso}T00:00:00.000Z`);
  const tasks = await prisma.housekeepingTask.findMany({
    where: { visitOutcome: { in: ['DND', 'SO'] } },
    include: { room: true },
  });
  const fo: Array<{ roomNumber: string; kind: string; days: number }> = [];
  for (const t of tasks) {
    const streak = await prisma.housekeepingTask.count({
      where: {
        roomId: t.roomId,
        visitOutcome: t.visitOutcome,
        businessDate: { lte: workDate },
      },
    });
    if (t.visitOutcome === 'DND' && streak >= 2) fo.push({ roomNumber: t.room.roomNumber, kind: 'DND', days: streak });
    if (t.visitOutcome === 'SO' && streak >= 3) fo.push({ roomNumber: t.room.roomNumber, kind: 'SO', days: streak });
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

export function laundryLineAmount(washQty: number, ironQty: number, washPrice: number, ironPrice: number, express: boolean) {
  const base = washQty * washPrice + ironQty * ironPrice;
  return express ? Math.round(base * 1.5 * 100) / 100 : Math.round(base * 100) / 100;
}

export function bakuClock(now: Date): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baku',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return { weekday, hour };
}

export function laundryIntakeBlockReason(input: {
  now: Date;
  express: boolean;
  dayType?: string | null;
  calendarUnavailable?: boolean;
}): string | null {
  const { weekday, hour } = bakuClock(input.now);
  if (weekday === 'Sun') return 'No laundry intake on Sunday';
  if (input.dayType === 'holiday' || input.dayType === 'transferred_rest') {
    return 'No laundry intake on labour holiday';
  }
  if (input.express && (hour < 9 || hour >= 17)) {
    return 'Express laundry is 09:00–17:00 Asia/Baku';
  }
  return null;
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

export async function postLaundryTicket(ticketId: string, now = new Date()) {
  const ticket = await prisma.laundryTicket.findUnique({
    where: { id: ticketId },
    include: { lines: { include: { item: true } } },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.status === 'POSTED') throw new Error('Already posted');
  let reservationId = ticket.reservationId;
  if (!reservationId) {
    const stay = await resolveStayForRoom(ticket.roomId);
    if (!stay) throw new Error('Reservation required');
    reservationId = stay.id;
    await prisma.laundryTicket.update({ where: { id: ticketId }, data: { reservationId } });
  }
  let dayType: string | null = null;
  let calendarUnavailable = false;
  const dayIso = isoDay(now);
  try {
    const days = await getCalendarDaysRange(dayIso, dayIso);
    dayType = days[0]?.dayType ?? null;
  } catch {
    calendarUnavailable = true;
  }
  const blocked = laundryIntakeBlockReason({ now, express: ticket.express, dayType, calendarUnavailable });
  if (blocked) throw new Error(blocked);
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
    );
    total += amt;
    if (wash || iron) summary.push(`${line.item.code} W${wash}/I${iron}`);
    const qtyMismatch = line.guestQty !== line.hotelQty;
    await prisma.laundryTicketLine.update({
      where: { id: line.id },
      data: { amount: toDecimal(amt), ...(qtyMismatch ? {} : {}) },
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
    businessDate: new Date(`${dayIso}T00:00:00.000Z`),
    description: `Laundry ${ticket.express ? 'express' : 'regular'} ticket ${ticket.id.slice(0, 8)} ${summary.join(', ')}`,
  });
  return prisma.laundryTicket.update({
    where: { id: ticketId },
    data: { status: 'POSTED', total: toDecimal(total), folioChargeId: charge.id, reservationId },
  });
}

export async function voidLaundryForCharge(chargeId: string) {
  const ticket = await prisma.laundryTicket.findFirst({ where: { folioChargeId: chargeId } });
  if (!ticket) return null;
  return prisma.laundryTicket.update({
    where: { id: ticket.id },
    data: { status: 'VOIDED', folioChargeId: null },
  });
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
      guest: { select: { vipType: true } },
    },
  });
  const nsr = await prisma.hkNsrDay.findMany({
    where: { workDate: { gte: from, lt: to } },
  });
  const byFloor = new Map<number, { floor: number; departures: number; arrivals: number; stayovers: number; nsr: number; vip: number }>();
  for (const r of rooms) {
    if (!byFloor.has(r.floor)) {
      byFloor.set(r.floor, { floor: r.floor, departures: 0, arrivals: 0, stayovers: 0, nsr: 0, vip: 0 });
    }
  }
  for (let i = 0; i < horizon; i++) {
    const day = addUtcDays(from, i);
    const key = isoDay(day);
    for (const s of stays) {
      const room = rooms.find((r) => r.id === s.roomId);
      if (!room) continue;
      const row = byFloor.get(room.floor)!;
      const ci = isoDay(s.checkInDate);
      const co = isoDay(s.checkOutDate);
      if (co === key) row.departures += 1;
      else if (ci === key) row.arrivals += 1;
      else if (ci < key && co > key) row.stayovers += 1;
      if ((s.vipType || s.guest.vipType) && (ci <= key && co > key)) row.vip += 1;
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

