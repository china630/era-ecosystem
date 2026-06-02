import "dotenv/config";
import { PrismaClient } from "../generated/client";
import { seedCalendarAz2026 } from "./seeds/calendar-az-2026";

const prisma = new PrismaClient();

async function main() {
  await seedCalendarAz2026(prisma);
  console.info("[data-hub:seed] calendar AZ 2026 done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
