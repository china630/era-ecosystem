/**
 * Idempotent reference dictionaries for hotel deployments.
 * Insert-if-missing only — never overwrites SatAdmin names or force-unretires.
 *
 * Usage: npm run db:seed (default) / npm run db:seed:reference
 * Requires tenant org (ERA_SATELLITE_ORGANIZATION_ID or ORGANIZATION_ID). No demo-org.
 */
import { HotelLookupKind, Prisma, PrismaClient } from "@prisma/client";
import { createSatelliteTenantExtension } from "@era/satellite-kit/tenancy";
import { HOTEL_LOOKUP_DEFAULTS } from "../src/lib/hotel-lookup-defaults";

const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as PrismaClient;

const FORBIDDEN_ORG = new Set(["demo-org", "demo-clinic-org", "demo-bank-org-001", "unbound"]);

function requireSeedOrgId(): string {
  const id =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (!id || FORBIDDEN_ORG.has(id)) {
    throw new Error(
      "ERA_SATELLITE_ORGANIZATION_ID (or ORGANIZATION_ID) required for hotel reference seed; demo-org is forbidden",
    );
  }
  return id;
}

const REVENUE_CODES = [
  { code: "ROOM", name: "Room", taxTag: "18%" },
  { code: "FOOD", name: "Food", taxTag: "18%" },
  { code: "BEVERAGE", name: "Beverage", taxTag: "18%" },
  { code: "MEDICAL", name: "Medical", taxTag: "18%" },
  { code: "LAUNDRY", name: "Laundry", taxTag: "18%" },
  { code: "TRANSFER", name: "Airport transfer", taxTag: "18%" },
  { code: "TOUR", name: "Guest tour", taxTag: "18%" },
  { code: "RATE_ADJ", name: "Same-day rate adjustment", taxTag: "18%" },
];

const BED_TYPES = [
  { code: "KNG", name: "King", systemType: "King" },
  { code: "DBL", name: "Double", systemType: "Double" },
  { code: "TWN", name: "Twin", systemType: "Twin" },
  { code: "TRP", name: "Triple", systemType: "Other" },
];

const ROOM_VIEWS = [
  { code: "ON_CEBHE", name: "On Cebhe" },
  { code: "ARKA_CEBHE", name: "Arka Cebhe" },
];

async function main() {
  const organizationId = requireSeedOrgId();
  process.env.ERA_SATELLITE_ORGANIZATION_ID = organizationId;

  let created = 0;

  for (const row of REVENUE_CODES) {
    const existing = await prisma.revenueCode.findUnique({
      where: { organizationId_code: { organizationId, code: row.code } },
    });
    if (!existing) {
      await prisma.revenueCode.create({
        data: { organizationId, ...row },
      });
      created += 1;
    }
  }

  for (const row of BED_TYPES) {
    const existing = await prisma.bedType.findUnique({
      where: { organizationId_code: { organizationId, code: row.code } },
    });
    if (!existing) {
      await prisma.bedType.create({
        data: { organizationId, ...row },
      });
      created += 1;
    }
  }

  for (const row of ROOM_VIEWS) {
    const existing = await prisma.roomView.findUnique({
      where: { organizationId_code: { organizationId, code: row.code } },
    });
    if (!existing) {
      await prisma.roomView.create({
        data: { organizationId, ...row },
      });
      created += 1;
    }
  }

  for (const row of HOTEL_LOOKUP_DEFAULTS) {
    const kind = row.kind as HotelLookupKind;
    const existing = await prisma.hotelLookup.findFirst({
      where: { organizationId, kind, code: row.code },
    });
    if (!existing) {
      await prisma.hotelLookup.create({
        data: {
          organizationId,
          kind,
          code: row.code,
          name: row.name,
          sortOrder: row.sortOrder,
        },
      });
      created += 1;
    }
  }

  console.log(
    `Reference seed complete for org ${organizationId}: ${created} inserted (existing left untouched). Catalogs: ${REVENUE_CODES.length} revenue, ${BED_TYPES.length} bed, ${ROOM_VIEWS.length} views, ${HOTEL_LOOKUP_DEFAULTS.length} lookups`,
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
