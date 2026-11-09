export const BONUS_CATEGORIES = [
  "consult",
  "physio",
  "massage",
  "lab",
  "func",
  "lfk",
  "cosmo",
] as const;

export type BonusCategory = (typeof BONUS_CATEGORIES)[number];

export type BonusShare = { refer: number; perform: number };

export type BonusRateTable = Record<BonusCategory, BonusShare>;

export type BonusSchedule = {
  vatPercent: number;
  profitTaxPercent: number;
  fundPercent: number;
  labPractitionerId: string | null;
  usPractitionerId: string | null;
  /** practitionerId -> 0..100. Missing means 100. */
  coefficients: Record<string, number>;
  walkIn: BonusRateTable;
  inHouse: BonusRateTable;
};

function share(refer: number, perform: number): BonusShare {
  return { refer, perform };
}

function table(rows: number[][]): BonusRateTable {
  const out = {} as BonusRateTable;
  BONUS_CATEGORIES.forEach((key, i) => {
    out[key] = share(rows[i]![0], rows[i]![1]);
  });
  return out;
}

/** Nafta sheet: направляющий / исполняющий, percents of the post-tax base. */
export const NAFTA_BONUS_SCHEDULE: BonusSchedule = {
  vatPercent: 18,
  profitTaxPercent: 20,
  fundPercent: 5,
  labPractitionerId: null,
  usPractitionerId: null,
  coefficients: {},
  walkIn: table([
    [15, 35],
    [25, 10],
    [10, 25],
    [20, 5],
    [10, 15],
    [25, 25],
    [10, 40],
  ]),
  inHouse: table([
    [0, 0],
    [10, 5],
    [5, 10],
    [10, 15],
    [10, 15],
    [0, 0],
    [10, 40],
  ]),
};

export function netFactor(schedule: BonusSchedule): number {
  const left = 100 - schedule.vatPercent - schedule.profitTaxPercent;
  return Math.max(0, left) / 100;
}

export function normalizeSchedule(raw: unknown): BonusSchedule {
  const base = structuredClone(NAFTA_BONUS_SCHEDULE);
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Partial<BonusSchedule>;
  if (typeof row.vatPercent === "number") base.vatPercent = row.vatPercent;
  if (typeof row.profitTaxPercent === "number") base.profitTaxPercent = row.profitTaxPercent;
  if (typeof row.fundPercent === "number") base.fundPercent = row.fundPercent;
  base.labPractitionerId = row.labPractitionerId ?? null;
  base.usPractitionerId = row.usPractitionerId ?? null;
  if (row.coefficients && typeof row.coefficients === "object") {
    base.coefficients = row.coefficients;
  }
  for (const group of ["walkIn", "inHouse"] as const) {
    const incoming = row[group];
    if (!incoming) continue;
    for (const key of BONUS_CATEGORIES) {
      const cell = incoming[key];
      if (!cell) continue;
      base[group][key] = {
        refer: Number(cell.refer) || 0,
        perform: Number(cell.perform) || 0,
      };
    }
  }
  return base;
}
