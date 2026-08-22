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
  try {
    days = await getCalendarDaysRange(workDateIso, workDateIso);
  } catch {
    days = [];
  }
  const day = days[0];
  const holiday = day && (day.dayType === 'holiday' || day.dayType === 'transferred_rest');
  if (!holiday) return { accrued: 0 };
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
  return { accrued };
}

export function nextPairIndex(yesterdayIndex: number, pairCount: number): number {
  if (pairCount <= 0) return 0;
  return (yesterdayIndex + 1) % pairCount;
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
        include: { guest: true },
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
    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      hkCondition: room.hkCondition,
      inventoryStatus: room.inventoryStatus,
      status: room.status,
      roomType: room.roomType.code,
      floor: room.floor,
      location: room.location,
      guests: stay?.guest.fullName ?? '',
      nationality: stay?.guest.nationality ?? '',
      vip: stay?.guest.vipType ?? stay?.vipType ?? '',
      agency: '',
      arrival: ci,
      departure: co,
      adults: stay?.adults ?? 0,
      children: (stay?.children11_6 ?? 0) + (stay?.children5_2 ?? 0) + (stay?.children1_0 ?? 0),
      repeat: stay?.guest ? 0 : 0,
      todayArrivalPax: todayArrival ? stay?.adults ?? 0 : 0,
      todayDepartPax: todayDepart ? stay?.adults ?? 0 : 0,
      jobType,
      maidName: maid?.housekeeper.name ?? '',
      reservationId: stay?.id ?? null,
    };
  });
  const rank = (j: HkJobType) =>
    j === 'DEPARTURE' ? 0 : j === 'ARRIVAL_PREP' ? 2 : j === 'STAYOVER' ? 3 : 4;
  return rows.sort((a, b) => {
    const vip = Number(Boolean(b.vip)) - Number(Boolean(a.vip));
    if (a.jobType === 'DEPARTURE' && b.jobType !== 'DEPARTURE') return -1;
    if (b.jobType === 'DEPARTURE' && a.jobType !== 'DEPARTURE') return 1;
    if (vip !== 0 && a.jobType !== 'DEPARTURE') return vip;
    return rank(a.jobType) - rank(b.jobType);
  });
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

export async function postLaundryTicket(ticketId: string) {
  const ticket = await prisma.laundryTicket.findUnique({
    where: { id: ticketId },
    include: { lines: { include: { item: true } } },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.status === 'POSTED') throw new Error('Already posted');
  if (!ticket.reservationId) throw new Error('Reservation required');
  let total = 0;
  for (const line of ticket.lines) {
    const wash = line.washQty;
    const iron = line.ironQty;
    const amt = laundryLineAmount(
      wash,
      iron,
      decimalToNumber(line.item.washPrice),
      decimalToNumber(line.item.ironPrice),
      ticket.express,
    );
    total += amt;
    await prisma.laundryTicketLine.update({
      where: { id: line.id },
      data: { amount: toDecimal(amt), hotelQty: Math.max(line.hotelQty, wash, iron) },
    });
  }
  const rev = await prisma.revenueCode.findFirst({ where: { code: 'LAUNDRY' } });
  if (!rev) throw new Error('LAUNDRY revenue code missing');
  const charge = await postCharge({
    reservationId: ticket.reservationId,
    revenueCodeId: rev.id,
    amount: total,
    description: `Laundry ${ticket.express ? 'express' : 'regular'}`,
  });
  return prisma.laundryTicket.update({
    where: { id: ticketId },
    data: { status: 'POSTED', total: toDecimal(total), folioChargeId: charge.id },
  });
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

