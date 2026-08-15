'use strict';
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const defaults = [
  ['SVC_FEE', 'Service fee', 'SERVICE_FEE', 'PER_PERSON_NIGHT', 10, 6, 5],
  ['MEAL_BREAKFAST', 'Breakfast', 'MEAL', 'PER_PERSON_MEAL', 20, 25, null],
  ['MEAL_LUNCH', 'Lunch', 'MEAL', 'PER_PERSON_MEAL', 30, 25, null],
  ['MEAL_DINNER', 'Dinner', 'MEAL', 'PER_PERSON_MEAL', 40, 25, null],
  ['FOOD_COGS_DAY', 'Food COGS (FB day)', 'FOOD_COGS', 'PER_PERSON_DAY', 50, null, 16],
  ['MEDICAL_COGS', 'Medical package COGS (base)', 'MEDICAL_COGS', 'PER_PERSON_NIGHT', 60, null, 20],
];

async function main() {
  const epoch = new Date('2026-01-01T00:00:00.000Z');
  for (const [code, name, kind, unit, sort, sell, cogs] of defaults) {
    let c = await p.pricingComponent.findUnique({
      where: { code },
      include: { versions: true },
    });
    if (!c) {
      await p.pricingComponent.create({
        data: {
          code,
          name,
          kind,
          unit,
          sortOrder: sort,
          versions: {
            create: {
              sellAmount: sell,
              cogsAmount: cogs,
              effectiveFrom: epoch,
              note: 'Initial seed (Nafta 2026)',
            },
          },
        },
      });
      console.log('created', code);
    } else if (!c.versions.length) {
      await p.pricingComponentVersion.create({
        data: {
          componentId: c.id,
          sellAmount: sell,
          cogsAmount: cogs,
          effectiveFrom: epoch,
          note: 'Initial seed (Nafta 2026)',
        },
      });
      console.log('versioned', code);
    } else {
      console.log(
        'exists',
        code,
        String(c.versions[0].sellAmount),
        String(c.versions[0].cogsAmount),
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });
