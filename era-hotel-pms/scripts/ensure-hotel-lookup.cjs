const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRawUnsafe(
    `SELECT to_regclass('public."HotelLookup"')::text AS t`,
  );
  console.log("HotelLookup regclass:", rows);
  if (!rows[0]?.t) {
    await p.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "HotelLookupKind" AS ENUM (
          'MARKET','SEGMENT','VIP_TYPE','LOYALTY_TIER','VISA_TYPE','TITLE','GENDER',
          'MARITAL_STATUS','TRIP_REASON','ACCOM_TYPE','RECORD_TYPE','SPECIAL_STATE','VERIFICATION_STATUS'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HotelLookup" (
        "id" TEXT NOT NULL,
        "kind" "HotelLookupKind" NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HotelLookup_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "HotelLookup_kind_code_key" ON "HotelLookup"("kind", "code");`,
    );
    await p.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "HotelLookup_kind_active_sortOrder_idx" ON "HotelLookup"("kind", "active", "sortOrder");`,
    );
    console.log("HotelLookup created");
  } else {
    console.log("HotelLookup already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
