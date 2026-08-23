/**
 * Idempotent reference dictionaries for all hotel deployments.
 * Safe to run repeatedly: upserts by natural `code` keys only (no wipe).
 *
 * Usage: npm run db:seed:reference
 */
import { HotelLookupKind, Prisma, PrismaClient } from '@prisma/client';
import { createSatelliteTenantExtension } from '@era/satellite-kit/tenancy';

const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as PrismaClient;

const REVENUE_CODES = [
  { code: 'ROOM', name: 'Room', taxTag: '18%' },
  { code: 'FOOD', name: 'Food', taxTag: '18%' },
  { code: 'BEVERAGE', name: 'Beverage', taxTag: '18%' },
  { code: 'MEDICAL', name: 'Medical', taxTag: '18%' },
  { code: 'LAUNDRY', name: 'Laundry', taxTag: '18%' },
  { code: 'TRANSFER', name: 'Transfer', taxTag: '18%' },
  { code: 'TOUR', name: 'Guest tour', taxTag: '18%' },
];

const BED_TYPES = [
  { code: 'KNG', name: 'King', systemType: 'King' },
  { code: 'DBL', name: 'Double', systemType: 'Double' },
  { code: 'TWN', name: 'Twin', systemType: 'Twin' },
  { code: 'TRP', name: 'Triple', systemType: 'Other' },
];

const ROOM_VIEWS = [
  { code: 'ON_CEBHE', name: 'On Cebhe' },
  { code: 'ARKA_CEBHE', name: 'Arka Cebhe' },
];

type LookupSeed = { kind: HotelLookupKind; code: string; name: string; sortOrder: number };

const LOOKUPS: LookupSeed[] = [
  ...(['Direct', 'Agency', 'Corporate', 'FIT', 'B2B'] as const).map((code, i) => ({
    kind: HotelLookupKind.MARKET,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['Leisure', 'Medical', 'Sanatorium', 'Group', 'Business'] as const).map((code, i) => ({
    kind: HotelLookupKind.SEGMENT,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['VIP', 'VVIP', 'NONE'] as const).map((code, i) => ({
    kind: HotelLookupKind.VIP_TYPE,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['STANDARD', 'SILVER', 'GOLD', 'PLATINUM'] as const).map((code, i) => ({
    kind: HotelLookupKind.LOYALTY_TIER,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['TOURIST', 'BUSINESS', 'TRANSIT', 'RESIDENCE'] as const).map((code, i) => ({
    kind: HotelLookupKind.VISA_TYPE,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['Mr', 'Mrs', 'Ms', 'Dr'] as const).map((code, i) => ({
    kind: HotelLookupKind.TITLE,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'] as const).map((code, i) => ({
    kind: HotelLookupKind.GENDER,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'] as const).map((code, i) => ({
    kind: HotelLookupKind.MARITAL_STATUS,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['Leisure', 'Medical', 'Business', 'Event', 'Other'] as const).map((code, i) => ({
    kind: HotelLookupKind.TRIP_REASON,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['RO', 'BB', 'HB', 'FB', 'AI'] as const).map((code, i) => ({
    kind: HotelLookupKind.ACCOM_TYPE,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['INDIVIDUAL', 'GROUP', 'COMPANY'] as const).map((code, i) => ({
    kind: HotelLookupKind.RECORD_TYPE,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['EARLY_CI', 'LATE_CO', 'NO_SMOKING', 'ACCESSIBLE'] as const).map((code, i) => ({
    kind: HotelLookupKind.SPECIAL_STATE,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['UNVERIFIED', 'PENDING', 'VERIFIED'] as const).map((code, i) => ({
    kind: HotelLookupKind.VERIFICATION_STATUS,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(
    [
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
    ] as const
  ).map((code, i) => ({
    kind: HotelLookupKind.NOTE_TYPE,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['EXCURSION', 'TICKET', 'RESTAURANT_EXT'] as const).map((code, i) => ({
    kind: HotelLookupKind.CONCIERGE_CATEGORY,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
  ...(['MENU', 'EQUIPMENT', 'STAFF', 'ROOM_RENTAL', 'OTHER'] as const).map((code, i) => ({
    kind: HotelLookupKind.EVENT_LINE_KIND,
    code,
    name: code,
    sortOrder: (i + 1) * 10,
  })),
];

async function main() {
  for (const row of REVENUE_CODES) {
    await prisma.revenueCode.upsert({
      where: { code: row.code },
      create: row,
      update: { name: row.name, taxTag: row.taxTag },
    });
  }

  for (const row of BED_TYPES) {
    await prisma.bedType.upsert({
      where: { code: row.code },
      create: row,
      update: { name: row.name, systemType: row.systemType },
    });
  }

  for (const row of ROOM_VIEWS) {
    await prisma.roomView.upsert({
      where: { code: row.code },
      create: row,
      update: { name: row.name },
    });
  }

  for (const row of LOOKUPS) {
    await prisma.hotelLookup.upsert({
      where: { kind_code: { kind: row.kind, code: row.code } },
      create: row,
      update: { name: row.name, sortOrder: row.sortOrder },
    });
  }

  console.log(
    `Reference seed complete: ${REVENUE_CODES.length} revenue codes, ${BED_TYPES.length} bed types, ${ROOM_VIEWS.length} room views, ${LOOKUPS.length} lookups`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
