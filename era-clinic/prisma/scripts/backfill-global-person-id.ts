/**
 * Backfill PatientRef.globalPersonId via MDM resolve.
 * Run: npx tsx prisma/scripts/backfill-global-person-id.ts
 */
import "dotenv/config";
import { resolvePersonIdentity } from "@era/satellite-kit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const patients = await prisma.patientRef.findMany({
    where: { globalPersonId: null },
    select: {
      id: true,
      fullName: true,
      phone: true,
      finCode: true,
      passportNumber: true,
      issuingCountry: true,
      nationality: true,
    },
  });

  let linked = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of patients) {
    try {
      const r = await resolvePersonIdentity({
        fin: p.finCode ?? undefined,
        passport: p.passportNumber ?? undefined,
        issuingCountry: p.issuingCountry ?? p.nationality ?? undefined,
        fullName: p.fullName,
        phone: p.phone ?? undefined,
        nationality: p.nationality ?? undefined,
      });
      if (!r.globalPersonId) {
        skipped++;
        continue;
      }
      await prisma.patientRef.update({
        where: { id: p.id },
        data: { globalPersonId: r.globalPersonId },
      });
      linked++;
    } catch (err) {
      failed++;
      console.warn(
        `Skip patient ${p.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  console.log(
    `Linked ${linked} / ${patients.length} patients (skipped ${skipped}, failed ${failed})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
