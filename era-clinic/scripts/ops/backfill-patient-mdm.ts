/**
 * Backfill PatientRef.globalPersonId via cutover MDM resolver (post #24 when MDM auth failed).
 * Run hotel guest backfill first so name+DOB / stay lookups succeed.
 * Org list: orchestrator pool registry (SHARED) or the process org (DEDICATED / ONPREM);
 * each org runs in its own tenant context with the kit filter on.
 * SHARED needs the orch URL, service token and ERA_PUBLIC_BASE_URL of this clinic process.
 *
 * Usage (from era-clinic):
 *   npx tsx scripts/ops/backfill-patient-mdm.ts [--dry-run] [--limit=N]
 */
import { listCronOrganizationIds, runWithSatelliteTenant } from '@era/satellite-kit';
import { fetchClinicPoolOrganizationIds } from '@/lib/cron-organization-ids';
import { resolveCutoverPatientMdm } from '@/lib/import/cutover-patient-mdm';
import { prisma } from '@/lib/prisma';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.slice(8), 10) : undefined;

function sexLabel(sex: string): string | undefined {
  if (sex === 'MALE') return 'M';
  if (sex === 'FEMALE') return 'F';
  return undefined;
}

async function backfillOrg(organizationId: string) {
  const patients = await prisma.patientRef.findMany({
    where: { globalPersonId: null },
    orderBy: { id: 'asc' },
    ...(limit && Number.isFinite(limit) ? { take: limit } : {}),
  });

  console.log(
    `[${organizationId}] Found ${patients.length} patients without globalPersonId (dryRun=${dryRun})`,
  );

  let linked = 0;
  let failed = 0;

  for (const patient of patients) {
    const episode = await prisma.clinicalEpisode.findFirst({
      where: { patientRefId: patient.id },
      orderBy: { openedAt: 'desc' },
      select: { reservationId: true },
    });

    if (dryRun) {
      linked += 1;
      continue;
    }

    const globalPersonId = await resolveCutoverPatientMdm({
      fullName: patient.fullName,
      firstName: patient.firstName || undefined,
      middleName: patient.middleName,
      lastName: patient.lastName || undefined,
      phone: patient.phone ?? undefined,
      nationality: patient.nationality ?? undefined,
      sex: sexLabel(patient.sex),
      birthDate: patient.birthDate?.toISOString().slice(0, 10),
      hotelResNo: episode?.reservationId ?? undefined,
    });

    if (globalPersonId?.trim()) {
      await prisma.patientRef.update({
        where: { id: patient.id },
        data: { globalPersonId: globalPersonId.trim() },
      });
      linked += 1;
    } else {
      failed += 1;
    }
  }

  return { organizationId, total: patients.length, linked, failed, dryRun };
}

async function main() {
  const organizationIds = await listCronOrganizationIds(fetchClinicPoolOrganizationIds);
  const results = [];
  for (const organizationId of organizationIds) {
    results.push(await runWithSatelliteTenant({ organizationId }, () => backfillOrg(organizationId)));
  }
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
