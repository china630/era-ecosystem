/**
 * Idempotent reference dictionaries for all hotel deployments.
 * Safe to run repeatedly: upserts by natural `code` keys only (no wipe).
 *
 * Usage: npm run db:seed:reference
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REVENUE_CODES = [
  { code: 'ROOM', name: 'Room', taxTag: '18%' },
  { code: 'FOOD', name: 'Food', taxTag: '18%' },
  { code: 'BEVERAGE', name: 'Beverage', taxTag: '18%' },
  { code: 'MEDICAL', name: 'Medical', taxTag: '18%' },
  { code: 'LAUNDRY', name: 'Laundry', taxTag: '18%' },
  { code: 'TRANSFER', name: 'Transfer', taxTag: '18%' },
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

  console.log(
    `Reference seed complete: ${REVENUE_CODES.length} revenue codes, ${BED_TYPES.length} bed types, ${ROOM_VIEWS.length} room views`,
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
