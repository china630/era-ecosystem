import type { OtaReservationPayload } from '@/lib/channel/adapters/types';

type UnknownRecord = Record<string, unknown>;

function asRecord(v: unknown): UnknownRecord {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as UnknownRecord) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Map Channex Booking Revision attributes → ERA OTA payload.
 * Docs: GET /api/v1/booking_revisions/:id — rooms[].room_type_id / rate_plan_id are UUIDs.
 */
export function normalizeChannexRevision(attrs: unknown): OtaReservationPayload {
  const a = asRecord(attrs);
  const customer = asRecord(a.customer);
  const occupancy = asRecord(a.occupancy);
  const rooms = asArray(a.rooms).map(asRecord);
  const room = rooms[0] ?? {};
  const status = String(a.status ?? 'new').toLowerCase();
  const event: OtaReservationPayload['event'] =
    status === 'cancelled' || status.includes('cancel')
      ? 'cancel'
      : status === 'modified' || status.includes('modif')
        ? 'modify'
        : 'create';

  const first = String(customer.name ?? customer.first_name ?? '').trim();
  const last = String(customer.surname ?? customer.last_name ?? '').trim();
  const fullName = `${first} ${last}`.trim() || 'OTA Guest';

  const paymentType = String(a.payment_type ?? '').toLowerCase();
  const paymentMethod =
    paymentType === 'credit_card'
      ? 'CARD'
      : paymentType === 'bank_transfer'
        ? 'BANK_TRANSFER'
        : 'COMPANY_ACCOUNT';

  const amountRaw = a.amount ?? room.amount;
  const totalAmount =
    amountRaw != null && amountRaw !== '' ? Number(amountRaw) : undefined;

  return {
    externalReservationId: String(
      a.unique_id ?? a.ota_reservation_code ?? a.booking_id ?? a.id ?? '',
    ),
    event,
    channelCode: 'CHANNEX',
    guest: {
      externalGuestId: a.booking_id ? String(a.booking_id) : undefined,
      fullName,
      email: customer.mail ? String(customer.mail) : customer.email ? String(customer.email) : undefined,
      phone: customer.phone ? String(customer.phone) : undefined,
    },
    checkInDate: String(a.arrival_date ?? room.checkin_date ?? ''),
    checkOutDate: String(a.departure_date ?? room.checkout_date ?? ''),
    otaRoomCode: String(room.room_type_id ?? ''),
    otaRateCode: room.rate_plan_id ? String(room.rate_plan_id) : undefined,
    adults: occupancy.adults != null ? Number(occupancy.adults) : room.occupancy
      ? Number(asRecord(room.occupancy).adults ?? 1)
      : undefined,
    children: occupancy.children != null ? Number(occupancy.children) : undefined,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
    currency: a.currency ? String(a.currency) : 'AZN',
    paymentMethod,
  };
}

export function parseChannexWebhookNotification(body: unknown): {
  propertyId: string;
  revisionId: string;
  bookingId: string;
} {
  const root = asRecord(body);
  const payload = asRecord(root.payload);
  const propertyId = String(
    payload.property_id ?? root.property_id ?? root.propertyId ?? '',
  ).trim();
  const revisionId = String(
    payload.revision_id ?? root.revision_id ?? root.revisionId ?? '',
  ).trim();
  const bookingId = String(
    payload.booking_id ?? root.booking_id ?? root.bookingId ?? '',
  ).trim();
  return { propertyId, revisionId, bookingId };
}
