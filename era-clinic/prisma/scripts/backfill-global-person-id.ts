/**
 * Report PatientRef rows missing globalPersonId (run before W1 migration to resolve via legacy script).
 * Post-migration: lists orphans requiring manual MDM resolve in UI.
 * Usage: npx tsx prisma/scripts/backfill-global-person-id.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const patients = await prisma.patientRef.findMany({
    where: { globalPersonId: null },
    select: { id: true, refCode: true, fullName: true, phone: true },
  });

  if (patients.length === 0) {
    console.log("All patients have globalPersonId.");
    return;
  }

  console.warn(`Patients without globalPersonId: ${patients.length}`);
  for (const p of patients) {
    console.warn(`  ${p.refCode} — ${p.fullName} (${p.id})`);
  }
  console.warn(
    "Resolve via clinic UI (re-enter FIN/passport) or run pre-migration backfill before DROP columns.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
