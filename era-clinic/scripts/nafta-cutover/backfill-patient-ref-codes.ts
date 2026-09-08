/**
 * Backfill legacy PatientRef.refCode (wo-patient-*, WALKIN-*, HOTEL-*, MDM-*)
 * to clinic-native P-######. Preserves CutoverImportKey wo:patient:* bindings.
 *
 *   npx tsx scripts/nafta-cutover/backfill-patient-ref-codes.ts
 *   npx tsx scripts/nafta-cutover/backfill-patient-ref-codes.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import {
  formatPatientRefCode,
  isLegacyExternalPatientRefCode,
  legacyRefCodeToExternalRef,
} from "../../src/domain/patient/patient-ref-code";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const patients = await prisma.patientRef.findMany({
    select: {
      id: true,
      organizationId: true,
      refCode: true,
      fullName: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byOrg = new Map<string, typeof patients>();
  for (const p of patients) {
    if (!isLegacyExternalPatientRefCode(p.refCode)) continue;
    const list = byOrg.get(p.organizationId) ?? [];
    list.push(p);
    byOrg.set(p.organizationId, list);
  }

  let planned = 0;
  for (const [orgId, rows] of byOrg) {
    let tenant = await prisma.tenant.findFirst({ where: { organizationId: orgId } });
    if (!tenant) {
      console.log(`[${orgId}] no Tenant row — would create`);
      if (APPLY) {
        tenant = await prisma.tenant.create({
          data: {
            organizationId: orgId,
            code: orgId.slice(0, 24) || "clinic",
            name: "Clinic",
            nextPatientSeq: 1,
          },
        });
      }
    }
    let seq = tenant?.nextPatientSeq ?? 1;
    for (const row of rows) {
      const nextCode = formatPatientRefCode(seq);
      const externalRef = legacyRefCodeToExternalRef(row.refCode);
      console.log(
        `${APPLY ? "APPLY" : "DRY"} ${row.refCode} → ${nextCode} (${row.fullName})` +
          (externalRef ? ` key=${externalRef}` : ""),
      );
      if (APPLY) {
        await prisma.patientRef.update({
          where: { id: row.id },
          data: {
            refCode: nextCode,
            ...(row.firstName
              ? {}
              : {
                  firstName: row.fullName.split(/\s+/)[0] || row.fullName,
                  lastName: row.fullName.split(/\s+/).slice(-1)[0] || "",
                }),
          },
        });
        if (externalRef) {
          const existing = await prisma.cutoverImportKey.findFirst({
            where: { organizationId: orgId, entity: "patients", externalRef },
          });
          if (!existing) {
            await prisma.cutoverImportKey.create({
              data: {
                organizationId: orgId,
                entity: "patients",
                externalRef,
                recordId: row.id,
              },
            });
          }
        }
      }
      seq += 1;
      planned += 1;
    }
    if (APPLY && tenant) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { nextPatientSeq: seq },
      });
    } else {
      console.log(`[${orgId}] nextPatientSeq would become ${seq}`);
    }
  }

  console.log(`${APPLY ? "Applied" : "Planned"} ${planned} refCode remaps`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
