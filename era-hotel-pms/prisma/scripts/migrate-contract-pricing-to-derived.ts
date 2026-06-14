/**
 * Convert active ContractPricingRule rows into DERIVED rate plans and SalesContract records.
 * Legacy ContractPricingRule table remains read-only for audit.
 * Usage: npx tsx prisma/scripts/migrate-contract-pricing-to-derived.ts [--dry-run]
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const bar = await prisma.ratePlan.findFirst({ where: { code: 'BAR', type: 'BASE' } });
  if (!bar) throw new Error('BAR base plan not found — run seed-bar-from-legacy.ts first');

  const rules = await prisma.contractPricingRule.findMany({
    where: { active: true },
    include: { agency: true, ratePlan: true },
  });

  let createdPlans = 0;
  let createdContracts = 0;

  for (const rule of rules) {
    const pct = Number(rule.valuePercent);
    const adjustment = rule.ruleType === 'DISCOUNT' ? -pct : pct;
    const code = `CPR-${rule.id.slice(0, 8).toUpperCase()}`;
    const name = rule.name || `Contract ${rule.agency?.name ?? 'global'}`;

    let derivedPlan = await prisma.ratePlan.findUnique({ where: { code } });

    if (!derivedPlan) {
      if (dryRun) {
        console.log('[dry-run] would create rate plan', code, adjustment);
        createdPlans += 1;
      } else {
        derivedPlan = await prisma.ratePlan.create({
          data: {
            code,
            name,
            type: 'DERIVED',
            derivedFromId: bar.id,
            adjustmentMode: 'PERCENT',
            adjustmentValue: new Prisma.Decimal(adjustment),
            pricePerNight: rule.ratePlan.pricePerNight,
            roomTypeId: rule.ratePlan.roomTypeId,
            mealPlanId: rule.ratePlan.mealPlanId,
            active: true,
          },
        });
        createdPlans += 1;
      }
    }

    const contractCode = `SC-${rule.id.slice(0, 8).toUpperCase()}`;
    const existingContract = await prisma.salesContract.findUnique({
      where: { legacyRuleId: rule.id },
    });
    if (existingContract) continue;

    if (dryRun) {
      console.log('[dry-run] would create sales contract', contractCode);
      createdContracts += 1;
      continue;
    }

    if (!derivedPlan) continue;

    await prisma.salesContract.create({
      data: {
        code: contractCode,
        name,
        counterpartyType: rule.agencyId ? 'AGENCY' : 'CORPORATE',
        agencyId: rule.agencyId,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        status: 'ACTIVE',
        ratePlanId: derivedPlan.id,
        legacyRuleId: rule.id,
        notes: `Migrated from ContractPricingRule ${rule.id}`,
      },
    });
    createdContracts += 1;
  }

  console.log(
    `${dryRun ? 'Dry-run:' : 'Done:'} ${createdPlans} DERIVED plans, ${createdContracts} SalesContract rows`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
