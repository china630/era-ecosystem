/**
 * Move Elektraweb channel "rate plans" (Booking.com, Expedia, …) onto the sell-path model for one org.
 *
 * For every active RatePlan whose code/name is an OTA channel (BAR, BAR-* and PKG* are never touched):
 *   - its reservations and stay slices move to the BAR price plan (totals are NOT recalculated);
 *   - reservations get source BOOKING (OTA) and the channel Agency (kept when already an OTA agency);
 *   - the channel plan is set active=false (not deleted — other rows may still reference it).
 *
 * Usage:
 *   npx tsx scripts/ops/reclass-elektra-rate-channels.ts --org=<uuid> [--dry-run]
 *
 * Requires an explicit org id (never runs across tenants). Dry run prints counts and writes nothing.
 */
import { isSentinelOrganizationId, runWithSatelliteTenant } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { isOtaAgency } from '@/lib/booking-source-kind';
import { ensureBarBasePlan } from '@/lib/pricing/bar-bootstrap.service';
import {
  channelAgencyId,
  classifyElektraRateCode,
  otaBookingSourceId,
} from '@/lib/integration/elektraweb-sell-path';

const dryRun = process.argv.includes('--dry-run');
const orgId = process.argv.find((a) => a.startsWith('--org='))?.slice(6)?.trim() || '';

if (!orgId || isSentinelOrganizationId(orgId)) {
  console.error('Pass --org=<uuid> (real org UUID)');
  process.exit(1);
}

type ChannelPlan = { id: string; code: string; name: string; channelLabel: string };

async function findChannelPlans(): Promise<ChannelPlan[]> {
  const plans = await prisma.ratePlan.findMany({
    where: { organizationId: orgId, active: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  const out: ChannelPlan[] = [];
  for (const p of plans) {
    const cls = classifyElektraRateCode({ code: p.code, name: p.name });
    if (cls.kind === 'channel') out.push({ ...p, channelLabel: cls.channelLabel });
  }
  return out;
}

async function report(plans: ChannelPlan[]) {
  for (const p of plans) {
    const [reservations, slices, contracts, mappings] = await Promise.all([
      prisma.reservation.count({ where: { organizationId: orgId, ratePlanId: p.id } }),
      prisma.reservationStaySlice.count({ where: { organizationId: orgId, ratePlanId: p.id } }),
      prisma.salesContract.count({ where: { organizationId: orgId, ratePlanId: p.id } }),
      prisma.channelRateMapping.count({ where: { organizationId: orgId, ratePlanId: p.id } }),
    ]);
    console.log(
      `${p.code} (${p.name}) → channel "${p.channelLabel}": reservations=${reservations} staySlices=${slices}` +
        (contracts || mappings ? ` [still referenced: salesContracts=${contracts} channelRateMappings=${mappings}]` : ''),
    );
  }
}

async function reclass(plans: ChannelPlan[]) {
  const { ratePlanId: barId, created } = await ensureBarBasePlan(prisma);
  if (created) console.log('Created BAR base plan');
  const sourceId = await otaBookingSourceId(prisma, orgId);
  const agencies = await prisma.agency.findMany({
    where: { organizationId: orgId },
    select: { id: true, code: true, name: true },
  });
  const otaAgencyIds = agencies.filter((a) => isOtaAgency(a.code, a.name)).map((a) => a.id);

  for (const p of plans) {
    const agencyId = await channelAgencyId(prisma, p.channelLabel, orgId);
    const result = await prisma.$transaction(async (tx) => {
      const agencyFill = await tx.reservation.updateMany({
        where: {
          organizationId: orgId,
          ratePlanId: p.id,
          OR: [{ agencyId: null }, { agencyId: { notIn: otaAgencyIds.length ? otaAgencyIds : ['-'] } }],
        },
        data: { agencyId },
      });
      const moved = await tx.reservation.updateMany({
        where: { organizationId: orgId, ratePlanId: p.id },
        data: { ratePlanId: barId, sourceId },
      });
      const slices = await tx.reservationStaySlice.updateMany({
        where: { organizationId: orgId, ratePlanId: p.id },
        data: { ratePlanId: barId },
      });
      await tx.ratePlan.update({ where: { id: p.id }, data: { active: false } });
      return { agencyFill: agencyFill.count, moved: moved.count, slices: slices.count };
    });
    console.log(
      `${p.code}: reservations moved=${result.moved} (agency set on ${result.agencyFill}), staySlices=${result.slices}, plan retired`,
    );
  }
}

async function main() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Reclass Elektraweb channel rate plans org=${orgId}`);
  const plans = await findChannelPlans();
  if (plans.length === 0) {
    console.log('No active channel rate plans found.');
    return;
  }
  await report(plans);
  if (dryRun) {
    const bar = await prisma.ratePlan.findFirst({ where: { organizationId: orgId, code: 'BAR' } });
    console.log(bar ? `BAR plan: ${bar.id}` : 'BAR plan missing — will be created');
    return;
  }
  await reclass(plans);
}

runWithSatelliteTenant({ organizationId: orgId }, main)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
