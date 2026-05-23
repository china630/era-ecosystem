import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';

export type RoomChargeIdempotencyInput = {
  reservationId?: string;
  roomNumber?: string;
  revenueCode: string;
  amount: number;
  description: string;
  outletCode?: string;
  productSku?: string;
};

export function hashRoomChargeRequest(input: RoomChargeIdempotencyInput): string {
  const normalized = {
    reservationId: input.reservationId ?? null,
    roomNumber: input.roomNumber ?? null,
    revenueCode: input.revenueCode,
    amount: input.amount,
    description: input.description,
    outletCode: input.outletCode ?? null,
    productSku: input.productSku ?? null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export async function findRoomChargeByIdempotencyKey(idempotencyKey: string) {
  const row = await prisma.posRoomChargeIdempotency.findUnique({
    where: { idempotencyKey },
  });
  if (!row) return null;
  return prisma.folioCharge.findUnique({
    where: { id: row.folioChargeId },
    include: { revenueCode: true, folio: true },
  });
}

export async function saveRoomChargeIdempotency(
  idempotencyKey: string,
  folioChargeId: string,
  reservationId: string,
  requestHash: string,
) {
  await prisma.posRoomChargeIdempotency.create({
    data: { idempotencyKey, folioChargeId, reservationId, requestHash },
  });
}

export async function isNightAuditRunning(): Promise<boolean> {
  const run = await prisma.nightAuditRun.findFirst({
    where: { status: 'RUNNING' },
  });
  return !!run;
}

export async function listInHouseGuests(params: {
  query?: string;
  roomNumber?: string;
  limit?: number;
}) {
  const limit = Math.min(params.limit ?? 20, 50);
  const where: {
    status: 'IN_HOUSE';
    room?: { roomNumber: string | { contains: string; mode: 'insensitive' } };
    OR?: Array<{
      room?: { roomNumber: { contains: string; mode: 'insensitive' } };
      guest?: { fullName: { contains: string; mode: 'insensitive' } };
    }>;
  } = { status: 'IN_HOUSE' };

  if (params.roomNumber) {
    where.room = { roomNumber: params.roomNumber };
  } else if (params.query && params.query.length >= 2) {
    const q = params.query;
    where.OR = [
      { room: { roomNumber: { contains: q, mode: 'insensitive' } } },
      { guest: { fullName: { contains: q, mode: 'insensitive' } } },
    ];
  } else if (params.query) {
    return [];
  }

  const naRunning = await isNightAuditRunning();

  const reservations = await prisma.reservation.findMany({
    where,
    take: limit,
    orderBy: [{ room: { roomNumber: 'asc' } }, { createdAt: 'desc' }],
    include: {
      guest: true,
      room: true,
      folios: { include: { charges: true, payments: true } },
    },
  });

  return reservations.map((res) => {
    const guestFolio =
      res.folios.find((f) => f.type === 'GUEST') ?? res.folios[0];
    const folioOpen = res.folios.some((f) => f.status === 'OPEN');
    const balanceHint = guestFolio
      ? folioBalance(guestFolio.charges, guestFolio.payments)
      : 0;
    const allowRoomCharge =
      res.status === 'IN_HOUSE' && folioOpen && !naRunning;

    return {
      reservationId: res.id,
      roomNumber: res.room?.roomNumber ?? null,
      guestName: res.guest.fullName,
      status: res.status,
      folioId: guestFolio?.id ?? null,
      folioStatus: guestFolio?.status ?? null,
      balanceHint,
      checkOutDate: res.checkOutDate.toISOString().slice(0, 10),
      allowRoomCharge,
    };
  });
}

export async function getFolioSummaryForPos(reservationId: string) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      folios: { include: { charges: true, payments: true } },
    },
  });
  if (!res) throw new Error('Reservation not found');

  const guestFolio =
    res.folios.find((f) => f.type === 'GUEST') ?? res.folios[0];
  if (!guestFolio) {
    return {
      reservationId: res.id,
      folioId: null,
      folioStatus: null,
      balance: 0,
      allowRoomCharge: false,
      denyReason: 'FOLIO_CLOSED' as const,
      creditLimit: null,
    };
  }

  const balance = folioBalance(guestFolio.charges, guestFolio.payments);
  const naRunning = await isNightAuditRunning();

  let allowRoomCharge = res.status === 'IN_HOUSE' && guestFolio.status === 'OPEN';
  let denyReason: string | null = null;

  if (res.status !== 'IN_HOUSE') {
    allowRoomCharge = false;
    denyReason = 'NOT_IN_HOUSE';
  } else if (guestFolio.status !== 'OPEN') {
    allowRoomCharge = false;
    denyReason = 'FOLIO_CLOSED';
  } else if (naRunning) {
    allowRoomCharge = false;
    denyReason = 'NIGHT_AUDIT_RUNNING';
  }

  return {
    reservationId: res.id,
    folioId: guestFolio.id,
    folioStatus: guestFolio.status,
    balance,
    allowRoomCharge,
    denyReason,
    creditLimit: null,
  };
}

export async function getPosShiftStatus() {
  const open = await prisma.posBridgeShift.findMany({
    where: { status: 'OPEN' },
    orderBy: { openedAt: 'asc' },
  });
  return {
    hasOpenShift: open.length > 0,
    openShiftCount: open.length,
    outlets: open.map((s) => ({
      outletCode: s.outletCode,
      shiftId: s.externalShiftId,
      openedAt: s.openedAt.toISOString(),
    })),
  };
}

export async function reportPosShiftStatus(input: {
  outletCode: string;
  shiftId: string;
  status: 'OPEN' | 'CLOSED';
  propertyCode?: string;
  openedAt?: string;
  closedAt?: string;
}) {
  const openedAt = input.openedAt ? new Date(input.openedAt) : new Date();
  const closedAt = input.closedAt ? new Date(input.closedAt) : new Date();

  await prisma.posBridgeShift.upsert({
    where: {
      outletCode_externalShiftId: {
        outletCode: input.outletCode,
        externalShiftId: input.shiftId,
      },
    },
    create: {
      outletCode: input.outletCode,
      externalShiftId: input.shiftId,
      propertyCode: input.propertyCode,
      status: input.status,
      openedAt,
      closedAt: input.status === 'CLOSED' ? closedAt : null,
    },
    update: {
      propertyCode: input.propertyCode,
      status: input.status,
      ...(input.status === 'OPEN'
        ? { openedAt, closedAt: null }
        : { closedAt }),
    },
  });
}

export async function assertNoOpenPosShifts(): Promise<void> {
  const open = await prisma.posBridgeShift.findFirst({
    where: { status: 'OPEN' },
  });
  if (open) {
    throw new Error(
      `Close all POS shifts (fb-pos outlet ${open.outletCode}) before night audit`,
    );
  }
}
