import { getChannelAvailability } from '@/lib/services/channel.service';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { prisma } from '@/lib/prisma';
import { getChannelManagerBindingByIbeKey } from '@/lib/channel/channel-manager-binding.service';
import { enterRequestTenant, requestOrganizationId } from '@/lib/request-organization';
import { enqueueAriPush } from '@/lib/channel/channel-ari-queue.service';
import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import { toDecimal } from '@/lib/decimal';
import type { PaymentMethod } from '@prisma/client';
import { IndustryModuleInactiveError } from '@/lib/hotel-module-gate';
import {
  IbeAuthError,
  IbeConflictError,
  IbeForbiddenError,
  IbeUnavailableError,
  deductHoldsFromAvailable,
  holdCoversNight,
  parseIbePublishableKey,
} from '@/lib/channel/ibe-helpers';

export {
  IbeAuthError,
  IbeConflictError,
  IbeForbiddenError,
  IbeUnavailableError,
  deductHoldsFromAvailable,
  holdCoversNight,
  ibeCorsHeaders,
  ibePreflightHeaders,
  parseIbePublishableKey,
} from '@/lib/channel/ibe-helpers';

export function ibeErrorStatus(err: unknown): number {
  if (
    err instanceof IbeAuthError ||
    err instanceof IbeForbiddenError ||
    err instanceof IbeConflictError ||
    err instanceof IbeUnavailableError
  ) {
    return err.status;
  }
  if (err instanceof IndustryModuleInactiveError) return 403;
  return 500;
}

export async function resolveIbeTenant(req: Request): Promise<{
  organizationId: string;
  origins: string[];
}> {
  const key = parseIbePublishableKey(req);
  if (!key) throw new IbeAuthError('IBE publishable key required');
  const binding = await getChannelManagerBindingByIbeKey(key);
  if (!binding?.ibePublishableKey) throw new IbeAuthError('Invalid IBE key');

  const origin = req.headers.get('origin')?.trim();
  const origins = Array.isArray(binding.ibeAllowedOrigins)
    ? (binding.ibeAllowedOrigins as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  if (origin) {
    if (origins.length === 0) throw new IbeForbiddenError('IBE origins not configured');
    if (origins.includes('*')) throw new IbeForbiddenError('Wildcard IBE origin is not allowed');
    if (!origins.includes(origin)) throw new IbeForbiddenError('Origin not allowed');
  }

  enterRequestTenant(binding.organizationId);
  return { organizationId: binding.organizationId, origins };
}

type Db = typeof prisma;

export async function searchIbeAvailability(
  input: {
    from: string;
    nights: number;
    adults?: number;
    children?: number;
  },
  db: Db = prisma,
) {
  const checkIn = new Date(input.from);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + Math.max(1, input.nights));
  const guests = (input.adults ?? 1) + (input.children ?? 0);
  const orgId = requestOrganizationId();

  const matrix = await getChannelAvailability(checkIn, checkOut);
  const plans = await db.ratePlan.findMany({
    where: { active: true, medicalFlag: false },
    take: 40,
    orderBy: { code: 'asc' },
  });
  const holds = await db.ibeHold.findMany({
    where: {
      organizationId: orgId,
      status: 'OPEN',
      expiresAt: { gt: new Date() },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
    },
    select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
  });

  const offers = [];
  for (const rt of matrix) {
    const nights = rt.days.map((n) => {
      const holdCount = holds.filter(
        (h) => h.roomTypeId === rt.roomTypeId && holdCoversNight(h, n.date),
      ).length;
      return deductHoldsFromAvailable(n.stopSell ? 0 : n.available, holdCount);
    });
    const minAvail = nights.length ? Math.min(...nights) : 0;
    if (minAvail <= 0) continue;
    const roomType = await db.roomType.findUnique({ where: { id: rt.roomTypeId } });
    if (!roomType?.active) continue;

    for (const plan of plans) {
      if (plan.roomTypeId && plan.roomTypeId !== rt.roomTypeId) continue;
      try {
        const quote = await quoteReservationStay({
          ratePlanId: plan.id,
          roomTypeId: rt.roomTypeId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guests,
        });
        offers.push({
          roomTypeId: rt.roomTypeId,
          roomTypeCode: rt.roomTypeCode,
          roomTypeName: roomType.name,
          ratePlanId: plan.id,
          ratePlanCode: plan.code,
          ratePlanName: plan.name,
          available: minAvail,
          amountPerNight: quote.adultNightly,
          totalAmount: quote.totalAmount,
          currency: quote.currency,
        });
      } catch {
        /* skip unquotable */
      }
    }
  }

  return {
    from: input.from,
    nights: input.nights,
    adults: input.adults ?? 1,
    children: input.children ?? 0,
    offers,
  };
}

export async function createIbeHold(input: {
  roomTypeId: string;
  ratePlanId: string;
  from: string;
  nights: number;
  adults?: number;
  children?: number;
  ttlMinutes?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const avail = await searchIbeAvailability(
      {
        from: input.from,
        nights: input.nights,
        adults: input.adults,
        children: input.children,
      },
      tx as unknown as Db,
    );
    const match = avail.offers.find(
      (o) => o.roomTypeId === input.roomTypeId && o.ratePlanId === input.ratePlanId,
    );
    if (!match || match.available <= 0) {
      throw new IbeConflictError('No availability for hold');
    }

    const checkIn = new Date(input.from);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + Math.max(1, input.nights));
    const ttl = Math.min(60, Math.max(5, input.ttlMinutes ?? 15));

    return tx.ibeHold.create({
      data: {
        organizationId: requestOrganizationId(),
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: input.adults ?? 1,
        children: input.children ?? 0,
        expiresAt: new Date(Date.now() + ttl * 60_000),
        status: 'OPEN',
      },
    });
  });
}

async function enqueueChannexAfterDirectBook(roomTypeId: string, checkIn: Date, checkOut: Date) {
  const adapter = await resolveChannelAdapter();
  if (adapter.code !== 'channex') return;
  const mapping = await prisma.channelRoomMapping.findFirst({
    where: {
      roomTypeId,
      channel: { code: 'CHANNEX', organizationId: requestOrganizationId() },
    },
    include: { channel: { include: { rateMappings: true } } },
  });
  if (!mapping) return;
  const matrix = await getChannelAvailability(checkIn, checkOut);
  const rt = matrix.find((m) => m.roomTypeId === roomTypeId);
  const rate = mapping.channel.rateMappings[0];
  const rows = (rt?.days ?? []).map((d) => ({
    date: d.date,
    otaRoomCode: mapping.otaRoomCode,
    otaRateCode: rate?.otaRateCode,
    available: d.available,
    stopSell: d.stopSell || d.available <= 0,
  }));
  if (rows.length) {
    try {
      await enqueueAriPush(rows);
    } catch {
      /* best-effort */
    }
  }
}

export async function bookIbe(input: {
  holdId?: string;
  roomTypeId: string;
  ratePlanId: string;
  from: string;
  nights: number;
  adults?: number;
  children?: number;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  paymentMethod?: PaymentMethod;
  idempotencyKey: string;
}) {
  const orgId = requestOrganizationId();
  const paymentMethod: PaymentMethod = input.paymentMethod ?? 'CARD';

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        organizationId: orgId,
        externalRef: `ibe:${input.idempotencyKey}`,
      },
    });
    if (existing) return { reservation: existing, idempotent: true as const };

    if (input.holdId) {
      const hold = await tx.ibeHold.findFirst({
        where: { id: input.holdId, organizationId: orgId, status: 'OPEN' },
      });
      if (!hold || hold.expiresAt < new Date()) {
        throw new IbeConflictError('Hold expired or missing');
      }
    }

    const avail = await searchIbeAvailability(
      {
        from: input.from,
        nights: input.nights,
        adults: input.adults,
        children: input.children,
      },
        tx as unknown as Db,
    );
    const match = avail.offers.find(
      (o) => o.roomTypeId === input.roomTypeId && o.ratePlanId === input.ratePlanId,
    );
    if (!match || match.available <= 0) {
      throw new IbeConflictError('No availability — overbook refused');
    }

    const checkIn = new Date(input.from);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + Math.max(1, input.nights));

    let source = await tx.bookingSource.findFirst({ where: { code: 'WEB' } });
    if (!source) {
      source = await tx.bookingSource.create({
        data: {
          organizationId: orgId,
          code: 'WEB',
          name: 'Direct website',
        },
      });
    }

    const guest = await tx.guest.create({
      data: {
        organizationId: orgId,
        fullName: input.guestName,
        email: input.guestEmail,
        phone: input.guestPhone,
        externalRef: `ibe-guest:${input.idempotencyKey}`,
      },
    });

    const reservation = await tx.reservation.create({
      data: {
        organizationId: orgId,
        guestId: guest.id,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        sourceId: source.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: input.adults ?? 1,
        children11_6: input.children ?? 0,
        status: 'CONFIRMED',
        paymentMethod,
        totalAmount: toDecimal(match.totalAmount),
        externalRef: `ibe:${input.idempotencyKey}`,
        market: 'DIRECT',
        segment: 'WEB',
      },
    });

    if (input.holdId) {
      await tx.ibeHold.updateMany({
        where: { id: input.holdId, organizationId: orgId },
        data: { status: 'CONSUMED' },
      });
    }

    return { reservation, idempotent: false as const, checkIn, checkOut };
  });

  if (!result.idempotent && 'checkIn' in result) {
    await enqueueChannexAfterDirectBook(input.roomTypeId, result.checkIn, result.checkOut);
  }

  return { reservation: result.reservation, idempotent: result.idempotent };
}
