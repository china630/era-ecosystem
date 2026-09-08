/**
 * Canonical HotelLookup seed rows (guest card / reservation pick-lists).
 * Shared by prisma/seed-reference and runtime ensureHotelLookupsSeeded.
 */
export type HotelLookupDefault = {
  kind: string;
  code: string;
  name: string;
  sortOrder: number;
};

function mapCodes(
  kind: string,
  codes: readonly string[],
  names?: Record<string, string>,
): HotelLookupDefault[] {
  return codes.map((code, i) => ({
    kind,
    code,
    name: names?.[code] ?? code,
    sortOrder: (i + 1) * 10,
  }));
}

export const HOTEL_LOOKUP_DEFAULTS: HotelLookupDefault[] = [
  ...mapCodes('MARKET', ['Direct', 'Agency', 'Corporate', 'FIT', 'B2B']),
  ...mapCodes('SEGMENT', ['Leisure', 'Medical', 'Sanatorium', 'Group', 'Business']),
  ...mapCodes('VIP_TYPE', ['VIP', 'VVIP', 'NONE']),
  ...mapCodes('LOYALTY_TIER', ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM']),
  ...mapCodes('VISA_TYPE', ['TOURIST', 'BUSINESS', 'TRANSIT', 'RESIDENCE']),
  ...mapCodes('TITLE', ['Mr', 'Mrs', 'Ms', 'Dr']),
  ...mapCodes(
    'GENDER',
    ['M', 'F', 'OTHER'],
    { M: 'Male', F: 'Female', OTHER: 'Other' },
  ),
  ...mapCodes('MARITAL_STATUS', ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER']),
  ...mapCodes('TRIP_REASON', ['Leisure', 'Medical', 'Business', 'Event', 'Other']),
  ...mapCodes('ACCOM_TYPE', ['RO', 'BB', 'HB', 'FB', 'AI']),
  ...mapCodes('RECORD_TYPE', ['INDIVIDUAL', 'GROUP', 'COMPANY']),
  ...mapCodes('SPECIAL_STATE', ['EARLY_CI', 'LATE_CO', 'NO_SMOKING', 'ACCESSIBLE']),
  ...mapCodes('VERIFICATION_STATUS', ['UNVERIFIED', 'PENDING', 'VERIFIED']),
  ...mapCodes('NOTE_TYPE', [
    'EXTRA_REQ',
    'RES_NOTE',
    'CIN_NOTE',
    'COUT_NOTE',
    'ROOM_NOTE',
    'CANCEL_NOTE',
    'PAYMENT_NOTE',
    'PRICE_NOTE',
    'INVOICE_NOTE',
    'CONFIRMATION',
    'GENERAL_NOTE',
    'ARRIVAL_POSTPONED',
    'DEPARTURE_EXTENDED',
    'SET_ARRIVAL_EARLY',
    'SET_DEPARTURE_EARLY',
  ]),
  ...mapCodes('CONCIERGE_CATEGORY', ['EXCURSION', 'TICKET', 'RESTAURANT_EXT']),
  ...mapCodes('EVENT_LINE_KIND', ['MENU', 'EQUIPMENT', 'STAFF', 'ROOM_RENTAL', 'OTHER']),
];
