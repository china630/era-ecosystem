import { bakuTimeLabel, parseBakuDateTime } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import { assertVehicleSlotFree, TRANSFER_OCCUPANCY_MS } from '@/lib/services/tour.service';
import { cancelTransfer } from '@/lib/services/transfer.service';

export type TransferStayAction = 'SHIFT' | 'KEEP' | 'CANCEL' | 'LEAVE';

export type TransferStayDecision = {
  orderId: string;
  action: TransferStayAction;
  /** Required for SHIFT when caller overrides the proposal. */
  pickupAt?: string;
};

export type OpenTransferRow = {
  id: string;
  direction: 'IN' | 'OUT';
  status: string;
  pickupAt: Date;
  vehicleId: string | null;
  flightNo: string | null;
  proposedPickupAt: Date;
};

const OPEN_TRANSFER = ['BOOKED', 'CONFIRMED'] as const;

function transferOccupancyWindow(pickupAt: Date) {
  return {
    from: pickupAt,
    to: new Date(pickupAt.getTime() + TRANSFER_OCCUPANCY_MS),
  };
}

/** Keep Baku wall-clock time; move civil day. */
export function shiftPickupToDay(pickupAt: Date, targetYmd: string): Date {
  const hhmm = bakuTimeLabel(pickupAt);
  return parseBakuDateTime(targetYmd.slice(0, 10), hhmm);
}

export async function listOpenTransfersForStay(reservationId: string) {
  return prisma.transferOrder.findMany({
    where: { reservationId, status: { in: [...OPEN_TRANSFER] } },
    orderBy: { pickupAt: 'asc' },
  });
}

export async function proposeTransferShiftsForStay(
  reservationId: string,
  stay: { checkInDate: Date; checkOutDate: Date },
): Promise<OpenTransferRow[]> {
  const rows = await listOpenTransfersForStay(reservationId);
  const inDay = hotelDateKey(stay.checkInDate);
  const outDay = hotelDateKey(stay.checkOutDate);
  return rows.map((row) => {
    const anchor = row.direction === 'OUT' ? outDay : inDay;
    return {
      id: row.id,
      direction: row.direction === 'OUT' ? ('OUT' as const) : ('IN' as const),
      status: row.status,
      pickupAt: row.pickupAt,
      vehicleId: row.vehicleId,
      flightNo: row.flightNo,
      proposedPickupAt: shiftPickupToDay(row.pickupAt, anchor),
    };
  });
}

export async function cancelOpenTransfersForStay(reservationId: string, reason: string) {
  const rows = await listOpenTransfersForStay(reservationId);
  const cancelled: string[] = [];
  for (const row of rows) {
    await cancelTransfer(row.id, reason);
    cancelled.push(row.id);
  }
  return { cancelledCount: cancelled.length, cancelledIds: cancelled };
}

async function applyOneTransferDecision(
  orderId: string,
  action: TransferStayAction,
  pickupAtIso?: string,
) {
  const order = await prisma.transferOrder.findUnique({ where: { id: orderId } });
  if (!order) throw Object.assign(new Error('Transfer order not found'), { status: 404 });
  if (!OPEN_TRANSFER.includes(order.status as (typeof OPEN_TRANSFER)[number])) {
    return { orderId, action: 'SKIPPED' as const };
  }

  if (action === 'KEEP' || action === 'LEAVE') {
    return { orderId, action };
  }
  if (action === 'CANCEL') {
    await cancelTransfer(orderId, 'Stay mobility sync');
    return { orderId, action };
  }

  // SHIFT
  const nextPickup = pickupAtIso ? new Date(pickupAtIso) : order.pickupAt;
  if (Number.isNaN(nextPickup.getTime())) {
    throw Object.assign(new Error('Invalid pickupAt for SHIFT'), { status: 400 });
  }

  let vehicleId = order.vehicleId;
  let status = order.status;
  if (vehicleId) {
    try {
      const slot = transferOccupancyWindow(nextPickup);
      await assertVehicleSlotFree({
        vehicleId,
        ...slot,
        exceptTransferId: orderId,
      });
    } catch {
      vehicleId = null;
      status = 'BOOKED';
    }
  }

  await prisma.transferOrder.update({
    where: { id: orderId },
    data: { pickupAt: nextPickup, vehicleId, status },
  });
  return { orderId, action: 'SHIFT' as const, vehicleCleared: vehicleId == null && !!order.vehicleId };
}

export async function applyTransferDecisions(
  reservationId: string,
  decisions: TransferStayDecision[],
) {
  const open = await listOpenTransfersForStay(reservationId);
  const openIds = new Set(open.map((o) => o.id));
  for (const d of decisions) {
    if (!openIds.has(d.orderId)) {
      throw Object.assign(new Error(`Transfer ${d.orderId} is not open on this stay`), {
        status: 400,
        code: 'TRANSFER_NOT_OPEN',
      });
    }
  }
  const results = [];
  for (const d of decisions) {
    results.push(await applyOneTransferDecision(d.orderId, d.action, d.pickupAt));
  }
  return results;
}

/** Date amend: every open transfer must appear in decisions. */
export async function assertTransferDateDecisionsOrThrow(
  reservationId: string,
  decisions: TransferStayDecision[] | undefined,
) {
  const open = await listOpenTransfersForStay(reservationId);
  if (open.length === 0) return;
  if (!decisions || decisions.length === 0) {
    throw Object.assign(new Error('Open transfers require SHIFT, KEEP, or CANCEL for the new stay dates'), {
      status: 409,
      code: 'TRANSFER_DATE_PENDING',
      transfers: open.map((o) => ({
        id: o.id,
        direction: o.direction,
        pickupAt: o.pickupAt.toISOString(),
        status: o.status,
      })),
    });
  }
  const covered = new Set(decisions.map((d) => d.orderId));
  for (const row of open) {
    if (!covered.has(row.id)) {
      throw Object.assign(new Error(`Missing decision for transfer ${row.id}`), {
        status: 409,
        code: 'TRANSFER_DATE_PENDING',
      });
    }
    const action = decisions.find((d) => d.orderId === row.id)?.action;
    if (!action || !['SHIFT', 'KEEP', 'CANCEL'].includes(action)) {
      throw Object.assign(new Error(`Invalid date-amend action for transfer ${row.id}`), {
        status: 400,
        code: 'TRANSFER_DATE_ACTION',
      });
    }
  }
}

/** Early checkout: every open OUT needs SHIFT | CANCEL | LEAVE. */
export async function assertTransferOutDecisionsOrThrow(
  reservationId: string,
  decisions: TransferStayDecision[] | undefined,
) {
  const open = await listOpenTransfersForStay(reservationId);
  const outs = open.filter((o) => o.direction === 'OUT');
  if (outs.length === 0) return outs;
  if (!decisions || decisions.length === 0) {
    throw Object.assign(new Error('Outbound transfers require SHIFT, CANCEL, or LEAVE before check-out'), {
      status: 409,
      code: 'TRANSFER_OUT_PENDING',
      transfers: outs.map((o) => ({
        id: o.id,
        direction: o.direction,
        pickupAt: o.pickupAt.toISOString(),
        status: o.status,
        vehicleId: o.vehicleId,
        flightNo: o.flightNo,
      })),
    });
  }
  const byId = new Map(decisions.map((d) => [d.orderId, d]));
  for (const row of outs) {
    const d = byId.get(row.id);
    if (!d || !['SHIFT', 'CANCEL', 'LEAVE'].includes(d.action)) {
      throw Object.assign(new Error(`Missing early-out decision for transfer ${row.id}`), {
        status: 409,
        code: 'TRANSFER_OUT_PENDING',
      });
    }
  }
  return outs;
}

export type TransferOutSnapshot = {
  orderId: string;
  action: TransferStayAction;
  priorPickupAt: string;
  priorVehicleId: string | null;
  priorStatus: string;
};

export async function applyEarlyOutTransferDecisions(
  reservationId: string,
  newOutYmd: string,
  decisions: TransferStayDecision[],
): Promise<TransferOutSnapshot[]> {
  const outs = await assertTransferOutDecisionsOrThrow(reservationId, decisions);
  const snaps: TransferOutSnapshot[] = [];
  const byId = new Map(decisions.map((d) => [d.orderId, d]));
  for (const row of outs) {
    const d = byId.get(row.id)!;
    snaps.push({
      orderId: row.id,
      action: d.action,
      priorPickupAt: row.pickupAt.toISOString(),
      priorVehicleId: row.vehicleId,
      priorStatus: row.status,
    });
    if (d.action === 'LEAVE') continue;
    if (d.action === 'CANCEL') {
      await cancelTransfer(row.id, 'Early checkout');
      continue;
    }
    const pickupAt = d.pickupAt ?? shiftPickupToDay(row.pickupAt, newOutYmd).toISOString();
    await applyOneTransferDecision(row.id, 'SHIFT', pickupAt);
  }
  return snaps;
}

export async function restoreTransferOutSnapshots(snaps: TransferOutSnapshot[] | undefined) {
  if (!snaps?.length) return;
  for (const snap of snaps) {
    if (snap.action !== 'SHIFT') continue;
    const order = await prisma.transferOrder.findUnique({ where: { id: snap.orderId } });
    if (!order || order.status === 'CANCELLED' || order.status === 'DONE') continue;
    await prisma.transferOrder.update({
      where: { id: snap.orderId },
      data: {
        pickupAt: new Date(snap.priorPickupAt),
        vehicleId: snap.priorVehicleId,
        status: snap.priorStatus === 'CONFIRMED' || snap.priorStatus === 'BOOKED' ? snap.priorStatus : order.status,
      },
    });
  }
}

export async function cancelReservedToursForStay(reservationId: string, reason: string) {
  const rows = await prisma.tourBooking.findMany({
    where: { reservationId, status: 'RESERVED' },
    select: { id: true },
  });
  for (const row of rows) {
    await prisma.tourBooking.update({
      where: { id: row.id },
      data: { status: 'CANCELLED', notes: reason },
    });
  }
  return { cancelledCount: rows.length, cancelledIds: rows.map((r) => r.id) };
}

/** Early out / shortened stay: drop RESERVED seats on departures on or after newOutYmd. */
export async function cancelReservedToursOutsideStay(
  reservationId: string,
  newOutYmd: string,
  reason: string,
) {
  const rows = await prisma.tourBooking.findMany({
    where: { reservationId, status: 'RESERVED' },
    include: { departure: { select: { id: true, date: true, agenda: true } } },
  });
  const cut = newOutYmd.slice(0, 10);
  const drop = rows.filter((b) => hotelDateKey(b.departure.date) >= cut);
  for (const row of drop) {
    await prisma.tourBooking.update({
      where: { id: row.id },
      data: { status: 'CANCELLED', notes: reason },
    });
  }
  return {
    cancelledCount: drop.length,
    cancelledIds: drop.map((r) => r.id),
    departures: drop.map((r) => ({
      bookingId: r.id,
      departureId: r.departure.id,
      date: hotelDateKey(r.departure.date),
      agenda: r.departure.agenda,
    })),
  };
}

export async function syncMobilityOnStayCancel(reservationId: string, reason: string) {
  const transfers = await cancelOpenTransfersForStay(reservationId, reason);
  const tours = await cancelReservedToursForStay(reservationId, reason);
  return { transfers, tours };
}
