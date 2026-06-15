import "dotenv/config";
import { PrismaClient } from "../generated/client";
import { seedCalendarAz } from "./seeds/calendar-az";

const prisma = new PrismaClient();

async function main() {
  await seedCalendarAz(prisma);
  console.info("[data-hub:seed] calendar AZ 2025–2028 done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
