import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import { resolveCreditLimitAzn } from '@/lib/services/guest-dedup.service';

export type RoomChargeIdempotencyInput = {
  reservationId?: string;
  roomNumber?: string;
  revenueCode: string;
  amount: number;
  description: string;
  outletCode?: string;
  productSku?: string;
  qty?: number;
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
    qty: input.qty ?? 1,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export async function findRoomChargeByIdempotencyKey(idempotencyKey: string) {
  const row = await prisma.posRoomChargeIdempotency.findFirst({
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
    data: {
      organizationId: requestOrganizationId(),
      idempotencyKey,
      folioChargeId,
      reservationId,
      requestHash,
    },
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
  const creditLimit = await resolveCreditLimitAzn(res.id);

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
  } else if (creditLimit != null && balance >= creditLimit) {
    allowRoomCharge = false;
    denyReason = 'CREDIT_LIMIT';
  }

  return {
    reservationId: res.id,
    folioId: guestFolio.id,
    folioStatus: guestFolio.status,
    balance,
    allowRoomCharge,
    denyReason,
    creditLimit,
  };
}

export async function validateRoomCharge(
  reservationId: string,
  chargeAmount: number,
): Promise<{ allowed: boolean; denyReason?: string }> {
  const summary = await getFolioSummaryForPos(reservationId);
  if (!summary.allowRoomCharge) {
    return { allowed: false, denyReason: summary.denyReason ?? 'DENIED' };
  }
  if (summary.creditLimit != null && summary.balance + chargeAmount > summary.creditLimit) {
    return { allowed: false, denyReason: 'CREDIT_LIMIT' };
  }
  return { allowed: true };
}

function fnbPosBaseUrl(): string | null {
  const raw =
    process.env.FNB_POS_URL?.trim() ||
    process.env.NEXT_PUBLIC_FNB_POS_URL?.trim() ||
    process.env.NEXT_PUBLIC_SATELLITE_FNB_POS_URL?.trim() ||
    '';
  return raw ? raw.replace(/\/$/, '') : null;
}

type LivePosShift = { outletCode: string; shiftId: string; openedAt: string };

type LivePosShifts =
  | { ok: true; shifts: LivePosShift[] }
  | { ok: false };

/** Live open shifts in fb-pos for this hotel's organization. `ok: false` when it cannot be asked. */
async function liveOpenShifts(organizationId: string): Promise<LivePosShifts> {
  const base = fnbPosBaseUrl();
  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  if (!base || !secret || !organizationId || organizationId === 'demo-org') return { ok: false };
  try {
    const res = await fetch(`${base}/api/internal/v1/shifts/open`, {
      headers: {
        'X-Pos-Bridge-Secret': secret,
        'x-era-organization-id': organizationId,
      },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as {
      open?: Array<{ outletCode?: string; shiftId?: string; openedAt?: string }>;
    };
    const shifts = (body.open ?? [])
      .map((row) => ({
        outletCode: row.outletCode?.trim() ?? '',
        shiftId: row.shiftId?.trim() ?? '',
        openedAt: row.openedAt?.trim() ?? '',
      }))
      .filter((row) => row.outletCode || row.shiftId);
    return { ok: true, shifts };
  } catch {
    return { ok: false };
  }
}

function auditOrganizationId(): string | null {
  try {
    const id = requestOrganizationId();
    if (!id || id === 'demo-org') return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * Drop this organization's hotel copies that fb-pos no longer lists.
 * A failed close ping leaves the old shift id OPEN here.
 * Another cafe's copy is left alone. A failed poll does not close anything.
 */
export async function reconcileStalePosBridgeShifts(): Promise<LivePosShifts> {
  const organizationId = auditOrganizationId();
  if (!organizationId) return { ok: false };
  const open = await prisma.posBridgeShift.findMany({
    where: { status: 'OPEN', organizationId },
  });
  const live = await liveOpenShifts(organizationId);
  if (!live.ok || open.length === 0) return live;
  const liveIds = new Set(live.shifts.map((row) => row.shiftId).filter(Boolean));
  const liveOutlets = new Set(live.shifts.map((row) => row.outletCode).filter(Boolean));
  const matchByShiftId = live.shifts.length === 0 || liveIds.size > 0;
  const stale = open.filter((row) =>
    matchByShiftId ? !liveIds.has(row.externalShiftId) : !liveOutlets.has(row.outletCode),
  );
  if (stale.length === 0) return live;
  await prisma.posBridgeShift.updateMany({
    where: { id: { in: stale.map((row) => row.id) }, organizationId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  return live;
}

export async function getPosShiftStatus() {
  const live = await reconcileStalePosBridgeShifts();
  if (live.ok) {
    return {
      confirmed: true,
      hasOpenShift: live.shifts.length > 0,
      openShiftCount: live.shifts.length,
      outlets: live.shifts.map((row) => ({
        outletCode: row.outletCode,
        shiftId: row.shiftId,
        openedAt: row.openedAt || null,
      })),
    };
  }
  const organizationId = auditOrganizationId();
  if (!organizationId) {
    return {
      confirmed: false,
      hasOpenShift: false,
      openShiftCount: 0,
      outlets: [],
    };
  }
  const open = await prisma.posBridgeShift.findMany({
    where: { status: 'OPEN', organizationId },
    orderBy: { openedAt: 'asc' },
  });
  return {
    confirmed: false,
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
      organizationId_outletCode_externalShiftId: {
        organizationId: requestOrganizationId(),
        outletCode: input.outletCode,
        externalShiftId: input.shiftId,
      },
    },
    create: {
      organizationId: requestOrganizationId(),
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
  const live = await reconcileStalePosBridgeShifts();
  if (live.ok) {
    if (live.shifts.length === 0) return;
    const outlets = [...new Set(live.shifts.map((row) => row.outletCode).filter(Boolean))];
    throw new Error(
      `Close all POS shifts (fb-pos outlet ${outlets.join(', ') || 'unknown'}) before night audit`,
    );
  }
  const organizationId = auditOrganizationId();
  const open = organizationId
    ? await prisma.posBridgeShift.findFirst({
        where: { status: 'OPEN', organizationId },
      })
    : null;
  if (open) {
    throw new Error(
      `Could not confirm POS shifts with F&B (hotel copy still open for ${open.outletCode}). Night audit stays blocked until F&B answers.`,
    );
  }
}
