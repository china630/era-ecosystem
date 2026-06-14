import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';
import { logSyncError } from '@/lib/services/channel.service';
import type { OtaReservationPayload } from '@/lib/channel/adapters/types';

async function resolveRoomTypeId(channelCode: string, otaRoomCode: string) {
  const channel = await prisma.channel.findFirst({
    where: { code: channelCode, active: true },
    include: { roomMappings: true },
  });
  if (channel) {
    const mapped = channel.roomMappings.find((m) => m.otaRoomCode === otaRoomCode);
    if (mapped) return mapped.roomTypeId;
  }

  const fallback = await prisma.roomType.findFirst({
    where: { code: otaRoomCode, active: true },
  });
  if (fallback) return fallback.id;

  const any = await prisma.roomType.findFirst({ where: { active: true }, orderBy: { code: 'asc' } });
  if (!any) throw new Error('No active room types configured');
  return any.id;
}

async function resolveRatePlanId(channelCode: string, otaRateCode?: string) {
  const channel = await prisma.channel.findFirst({
    where: { code: channelCode },
    include: { rateMappings: true },
  });
  if (channel && otaRateCode) {
    const mapped = channel.rateMappings.find((m) => m.otaRateCode === otaRateCode);
    if (mapped) return mapped.ratePlanId;
  }

  const bar = await prisma.ratePlan.findFirst({
    where: { active: true, type: 'BASE' },
    orderBy: { code: 'asc' },
  });
  if (bar) return bar.id;

  const any = await prisma.ratePlan.findFirst({ where: { active: true }, orderBy: { code: 'asc' } });
  if (!any) throw new Error('No active rate plans configured');
  return any.id;
}

async function resolveSourceId(channelCode: string) {
  const code = channelCode.toUpperCase();
  const existing = await prisma.bookingSource.findFirst({ where: { code } });
  if (existing) return existing.id;
  const created = await prisma.bookingSource.create({
    data: { code, name: channelCode },
  });
  return created.id;
}

async function upsertGuest(payload: OtaReservationPayload) {
  const externalRef =
    payload.guest.externalGuestId ??
    `ota:${payload.channelCode}:${payload.guest.fullName.replace(/\s+/g, '-').slice(0, 40)}`;

  const existing = await prisma.guest.findUnique({ where: { externalRef } });
  if (existing) {
    return prisma.guest.update({
      where: { id: existing.id },
      data: {
        fullName: payload.guest.fullName,
        email: payload.guest.email,
        phone: payload.guest.phone,
      },
    });
  }

  return prisma.guest.create({
    data: {
      externalRef,
      fullName: payload.guest.fullName,
      email: payload.guest.email,
      phone: payload.guest.phone,
    },
  });
}

export async function upsertOtaReservation(payload: OtaReservationPayload) {
  if (payload.event === 'cancel') {
    const existing = await prisma.reservation.findUnique({
      where: { externalRef: payload.externalReservationId },
    });
    if (!existing) {
      await logSyncError({
        otaReference: payload.externalReservationId,
        errorMessage: 'Cancel received for unknown OTA reservation',
      });
      return { action: 'cancel_missing' as const };
    }
    await prisma.reservation.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
    });
    return { action: 'cancelled' as const, reservationId: existing.id };
  }

  const roomTypeId = await resolveRoomTypeId(payload.channelCode, payload.otaRoomCode);
  const ratePlanId = await resolveRatePlanId(payload.channelCode, payload.otaRateCode);
  const sourceId = await resolveSourceId(payload.channelCode);
  const guest = await upsertGuest(payload);

  const checkInDate = new Date(payload.checkInDate);
  const checkOutDate = new Date(payload.checkOutDate);
  const totalAmount = payload.totalAmount ?? 0;

  const existing = await prisma.reservation.findUnique({
    where: { externalRef: payload.externalReservationId },
  });

  if (existing) {
    const updated = await prisma.reservation.update({
      where: { id: existing.id },
      data: {
        roomTypeId,
        ratePlanId,
        sourceId,
        guestId: guest.id,
        checkInDate,
        checkOutDate,
        adults: payload.adults ?? existing.adults,
        totalAmount: toDecimal(totalAmount || decimalToNumber(existing.totalAmount)),
        status: 'CONFIRMED',
      },
    });
    return { action: 'updated' as const, reservationId: updated.id };
  }

  const created = await prisma.reservation.create({
    data: {
      externalRef: payload.externalReservationId,
      roomTypeId,
      ratePlanId,
      sourceId,
      guestId: guest.id,
      checkInDate,
      checkOutDate,
      adults: payload.adults ?? 1,
      paymentMethod: payload.paymentMethod ?? 'COMPANY_ACCOUNT',
      totalAmount: toDecimal(totalAmount),
      status: 'CONFIRMED',
    },
  });

  return { action: 'created' as const, reservationId: created.id };
}

/** Map generic webhook body to normalized OTA payload. */
export function normalizeOtaWebhookBody(
  channel: string,
  body: Record<string, unknown>,
): OtaReservationPayload {
  const eventRaw = String(body.event ?? 'create').toLowerCase();
  const event =
    eventRaw.includes('cancel') ? 'cancel' : eventRaw.includes('modify') ? 'modify' : 'create';

  const payload = (body.payload ?? body) as Record<string, unknown>;
  const guest = (payload.guest ?? {}) as Record<string, unknown>;

  return {
    externalReservationId: String(
      body.externalReservationId ?? payload.externalReservationId ?? payload.id ?? '',
    ),
    event,
    channelCode: channel,
    guest: {
      externalGuestId: guest.externalGuestId ? String(guest.externalGuestId) : undefined,
      fullName: String(guest.fullName ?? guest.name ?? 'OTA Guest'),
      email: guest.email ? String(guest.email) : undefined,
      phone: guest.phone ? String(guest.phone) : undefined,
    },
    checkInDate: String(payload.checkInDate ?? payload.checkIn ?? new Date().toISOString().slice(0, 10)),
    checkOutDate: String(
      payload.checkOutDate ?? payload.checkOut ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    ),
    otaRoomCode: String(payload.otaRoomCode ?? payload.roomTypeCode ?? 'STD'),
    otaRateCode: payload.otaRateCode ? String(payload.otaRateCode) : undefined,
    adults: payload.adults != null ? Number(payload.adults) : undefined,
    children: payload.children != null ? Number(payload.children) : undefined,
    totalAmount: payload.totalAmount != null ? Number(payload.totalAmount) : undefined,
    currency: payload.currency ? String(payload.currency) : 'AZN',
  };
}
