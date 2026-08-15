import type { PricingAmountUnit, PricingComponentKind, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';

export const PRICING_COMPONENT_CODES = {
  SVC_FEE: 'SVC_FEE',
  MEAL_BREAKFAST: 'MEAL_BREAKFAST',
  MEAL_LUNCH: 'MEAL_LUNCH',
  MEAL_DINNER: 'MEAL_DINNER',
  FOOD_COGS_DAY: 'FOOD_COGS_DAY',
  MEDICAL_COGS: 'MEDICAL_COGS',
} as const;

type SeedDef = {
  code: string;
  name: string;
  kind: PricingComponentKind;
  unit: PricingAmountUnit;
  sortOrder: number;
  sellAmount: number | null;
  cogsAmount: number | null;
};

const DEFAULTS: SeedDef[] = [
  {
    code: PRICING_COMPONENT_CODES.SVC_FEE,
    name: 'Service fee',
    kind: 'SERVICE_FEE',
    unit: 'PER_PERSON_NIGHT',
    sortOrder: 10,
    sellAmount: 6,
    cogsAmount: 5,
  },
  {
    code: PRICING_COMPONENT_CODES.MEAL_BREAKFAST,
    name: 'Breakfast',
    kind: 'MEAL',
    unit: 'PER_PERSON_MEAL',
    sortOrder: 20,
    sellAmount: 25,
    cogsAmount: null,
  },
  {
    code: PRICING_COMPONENT_CODES.MEAL_LUNCH,
    name: 'Lunch',
    kind: 'MEAL',
    unit: 'PER_PERSON_MEAL',
    sortOrder: 30,
    sellAmount: 25,
    cogsAmount: null,
  },
  {
    code: PRICING_COMPONENT_CODES.MEAL_DINNER,
    name: 'Dinner',
    kind: 'MEAL',
    unit: 'PER_PERSON_MEAL',
    sortOrder: 40,
    sellAmount: 25,
    cogsAmount: null,
  },
  {
    code: PRICING_COMPONENT_CODES.FOOD_COGS_DAY,
    name: 'Food COGS (FB day)',
    kind: 'FOOD_COGS',
    unit: 'PER_PERSON_DAY',
    sortOrder: 50,
    sellAmount: null,
    cogsAmount: 16,
  },
  {
    code: PRICING_COMPONENT_CODES.MEDICAL_COGS,
    name: 'Medical package COGS (base)',
    kind: 'MEDICAL_COGS',
    unit: 'PER_PERSON_NIGHT',
    sortOrder: 60,
    sellAmount: null,
    cogsAmount: 20,
  },
];

function dayUtc(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function serializeVersion(v: {
  id: string;
  sellAmount: Prisma.Decimal | null;
  cogsAmount: Prisma.Decimal | null;
  currencyCode: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
  createdById: string | null;
  createdAt: Date;
}) {
  return {
    id: v.id,
    sellAmount: v.sellAmount != null ? decimalToNumber(v.sellAmount) : null,
    cogsAmount: v.cogsAmount != null ? decimalToNumber(v.cogsAmount) : null,
    currencyCode: v.currencyCode,
    effectiveFrom: v.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: v.effectiveTo ? v.effectiveTo.toISOString().slice(0, 10) : null,
    note: v.note,
    createdById: v.createdById,
    createdAt: v.createdAt.toISOString(),
  };
}

/** Idempotent catalog + initial versions (Nafta locked defaults). */
export async function ensurePricingComponentsSeeded() {
  const epoch = new Date('2026-01-01T00:00:00.000Z');
  for (const def of DEFAULTS) {
    const existing = await prisma.pricingComponent.findUnique({
      where: { code: def.code },
      include: { versions: { take: 1 } },
    });
    if (existing) {
      if (existing.versions.length === 0) {
        await prisma.pricingComponentVersion.create({
          data: {
            componentId: existing.id,
            sellAmount: def.sellAmount != null ? toDecimal(def.sellAmount) : null,
            cogsAmount: def.cogsAmount != null ? toDecimal(def.cogsAmount) : null,
            effectiveFrom: epoch,
            note: 'Initial seed',
          },
        });
      }
      continue;
    }
    await prisma.pricingComponent.create({
      data: {
        code: def.code,
        name: def.name,
        kind: def.kind,
        unit: def.unit,
        sortOrder: def.sortOrder,
        versions: {
          create: {
            sellAmount: def.sellAmount != null ? toDecimal(def.sellAmount) : null,
            cogsAmount: def.cogsAmount != null ? toDecimal(def.cogsAmount) : null,
            effectiveFrom: epoch,
            note: 'Initial seed (Nafta 2026)',
          },
        },
      },
    });
  }
}

export async function listPricingComponents(asOf?: Date) {
  await ensurePricingComponentsSeeded();
  const on = dayUtc(asOf ?? new Date());
  const rows = await prisma.pricingComponent.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      versions: { orderBy: { effectiveFrom: 'desc' } },
    },
  });

  return rows.map((c) => {
    const current =
      c.versions.find(
        (v) =>
          v.effectiveFrom <= on && (v.effectiveTo == null || v.effectiveTo >= on),
      ) ?? c.versions[0] ?? null;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      kind: c.kind,
      unit: c.unit,
      sortOrder: c.sortOrder,
      current: current ? serializeVersion(current) : null,
      history: c.versions.map(serializeVersion),
    };
  });
}

export async function getPricingComponent(code: string) {
  await ensurePricingComponentsSeeded();
  const c = await prisma.pricingComponent.findUnique({
    where: { code },
    include: { versions: { orderBy: { effectiveFrom: 'desc' } } },
  });
  if (!c) throw new Error('Pricing component not found');
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    kind: c.kind,
    unit: c.unit,
    sortOrder: c.sortOrder,
    history: c.versions.map(serializeVersion),
  };
}

export async function addPricingComponentVersion(input: {
  code: string;
  sellAmount?: number | null;
  cogsAmount?: number | null;
  effectiveFrom: Date;
  note?: string | null;
  createdById?: string | null;
}) {
  const component = await prisma.pricingComponent.findUnique({
    where: { code: input.code },
  });
  if (!component) throw new Error('Pricing component not found');

  const from = dayUtc(input.effectiveFrom);
  const dayBefore = new Date(from);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

  return prisma.$transaction(async (tx) => {
    await tx.pricingComponentVersion.updateMany({
      where: {
        componentId: component.id,
        effectiveTo: null,
        effectiveFrom: { lt: from },
      },
      data: { effectiveTo: dayBefore },
    });

    const overlap = await tx.pricingComponentVersion.findFirst({
      where: {
        componentId: component.id,
        effectiveFrom: from,
      },
    });
    if (overlap) {
      throw new Error('A version already starts on this date');
    }

    const created = await tx.pricingComponentVersion.create({
      data: {
        componentId: component.id,
        sellAmount:
          input.sellAmount === undefined || input.sellAmount === null
            ? null
            : toDecimal(input.sellAmount),
        cogsAmount:
          input.cogsAmount === undefined || input.cogsAmount === null
            ? null
            : toDecimal(input.cogsAmount),
        effectiveFrom: from,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
    });

    return serializeVersion(created);
  });
}

/** Recommended per-adult board add-ons from current component sells. */
export async function recommendedBoardAddOns(asOf?: Date) {
  const list = await listPricingComponents(asOf);
  const byCode = new Map(list.map((c) => [c.code, c.current]));
  const fee = byCode.get(PRICING_COMPONENT_CODES.SVC_FEE)?.sellAmount ?? 0;
  const breakfast = byCode.get(PRICING_COMPONENT_CODES.MEAL_BREAKFAST)?.sellAmount ?? 0;
  const lunch = byCode.get(PRICING_COMPONENT_CODES.MEAL_LUNCH)?.sellAmount ?? 0;
  const dinner = byCode.get(PRICING_COMPONENT_CODES.MEAL_DINNER)?.sellAmount ?? 0;
  return {
    serviceFee: fee,
    breakfast,
    lunch,
    dinner,
    extraAdultBb: fee + breakfast,
    extraAdultFb: fee + breakfast + lunch + dinner,
    foodCogsDay: byCode.get(PRICING_COMPONENT_CODES.FOOD_COGS_DAY)?.cogsAmount ?? null,
    medicalCogs: byCode.get(PRICING_COMPONENT_CODES.MEDICAL_COGS)?.cogsAmount ?? null,
  };
}
