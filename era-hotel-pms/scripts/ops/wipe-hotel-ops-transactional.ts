/**
 * Wipe hotel transactional ops for one org (Nafta re-import variant A).
 *
 * Removes guests, reservations, folios, notes, concierge and banquet orders — keeps master data
 * (room types, rooms, agencies, rate plans, revenue codes, lookups). Same service as the
 * super-admin screen `/settings/ops-wipe` (`src/lib/services/ops-wipe.service.ts`). This CLI
 * passes no selection, so the whole operational bucket is wiped. The screen can wipe a subset.
 *
 * Usage (staging):
 *   npx tsx scripts/ops/wipe-hotel-ops-transactional.ts --org=<uuid> [--dry-run]
 *   (or ERA_SATELLITE_ORGANIZATION_ID=<uuid> instead of --org)
 *
 * Requires explicit org id (never wipes all tenants). Runs inside that org's
 * tenant context with the kit filter on; explicit org where-clauses stay as a
 * second boundary.
 */
import { isSentinelOrganizationId, runWithSatelliteTenant } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { countOpsWipe, runOpsWipe } from '@/lib/services/ops-wipe.service';

const dryRun = process.argv.includes('--dry-run');
const orgId =
  process.argv.find((a) => a.startsWith('--org='))?.slice(6)?.trim() ||
  process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
  '';

if (!orgId || isSentinelOrganizationId(orgId)) {
  console.error('Pass --org=<uuid> or set ERA_SATELLITE_ORGANIZATION_ID (real org UUID)');
  process.exit(1);
}

function print(counts: Record<string, number>) {
  for (const [key, n] of Object.entries(counts)) console.log(`${key}: ${n}`);
}

async function main() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Wipe hotel transactional ops org=${orgId}`);
  if (dryRun) {
    print(await countOpsWipe(orgId));
    return;
  }
  const deleted = await runOpsWipe(orgId);
  print(deleted.before);
  console.log('Reservations/folios cleared; rooms set AVAILABLE');
  const remaining = await prisma.guest.count({ where: { organizationId: orgId } });
  console.log(`Guest rows remaining: ${remaining}`);
  if (remaining > 0) process.exitCode = 1;
}

runWithSatelliteTenant({ organizationId: orgId }, main)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
