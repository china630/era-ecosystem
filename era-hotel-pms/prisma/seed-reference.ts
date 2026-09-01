/**
 * Idempotent reference dictionaries for all hotel deployments.
 * Safe to run repeatedly: upserts by natural `code` keys only (no wipe).
 *
 * Usage: npm run db:seed:reference
 * Requires tenant org (ERA_SATELLITE_ORGANIZATION_ID or runtime bind).
 */
import { HotelLookupKind, Prisma, PrismaClient } from '@prisma/client';
import { createSatelliteTenantExtension } from '@era/satellite-kit/tenancy';
import { HOTEL_LOOKUP_DEFAULTS } from '../src/lib/hotel-lookup-defaults';

const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as PrismaClient;

const REVENUE_CODES = [
  { code: 'ROOM', name: 'Room', taxTag: '18%' },
  { code: 'FOOD', name: 'Food', taxTag: '18%' },
  { code: 'BEVERAGE', name: 'Beverage', taxTag: '18%' },
  { code: 'MEDICAL', name: 'Medical', taxTag: '18%' },
  { code: 'LAUNDRY', name: 'Laundry', taxTag: '18%' },
  { code: 'TRANSFER', name: 'Airport transfer', taxTag: '18%' },
  { code: 'TOUR', name: 'Guest tour', taxTag: '18%' },
  { code: 'RATE_ADJ', name: 'Same-day rate adjustment', taxTag: '18%' },
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

  for (const row of HOTEL_LOOKUP_DEFAULTS) {
    const kind = row.kind as HotelLookupKind;
    const existing = await prisma.hotelLookup.findFirst({
      where: { kind, code: row.code },
    });
    if (existing) {
      await prisma.hotelLookup.update({
        where: { id: existing.id },
        data: { name: row.name, sortOrder: row.sortOrder, active: true },
      });
    } else {
      await prisma.hotelLookup.create({
        data: {
          kind,
          code: row.code,
          name: row.name,
          sortOrder: row.sortOrder,
        },
      });
    }
  }

  console.log(
    `Reference seed complete: ${REVENUE_CODES.length} revenue codes, ${BED_TYPES.length} bed types, ${ROOM_VIEWS.length} room views, ${HOTEL_LOOKUP_DEFAULTS.length} lookups`,
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
