import { prisma } from "@/lib/prisma";
import { bakuDayBounds } from "@/lib/baku-day";
import {
  type BonusCategory,
  type BonusSchedule,
  netFactor,
  normalizeSchedule,
} from "@/domain/reports/bonus-schedule";

export async function loadBonusSchedule(): Promise<BonusSchedule> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant?.bonusScheduleJson) return normalizeSchedule(null);
  try {
    return normalizeSchedule(JSON.parse(tenant.bonusScheduleJson));
  } catch {
    return normalizeSchedule(null);
  }
}

export async function saveBonusSchedule(schedule: BonusSchedule): Promise<void> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) return;
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { bonusScheduleJson: JSON.stringify(normalizeSchedule(schedule)) },
  });
}

function categoryOfProcedure(code: string, name: string): BonusCategory | null {
  const hay = `${code} ${name}`.toLowerCase();
  if (/lfk|müalicəvi|mualicevi|лечебн/.test(hay)) return "lfk";
  if (/kosmet|kosmeto|космет/.test(hay)) return "cosmo";
  if (/konsult|consult|приём|прием|müayinə|muayine/.test(hay)) return "consult";
  if (/fizioterap|fizyo|physio|физио/.test(hay)) return "physio";
  if (/massaj|masaj|massage|массаж/.test(hay)) return "massage";
  if (/ekg|ecg|экг|funks|функ/.test(hay)) return "func";
  return null;
}

function isUltrasound(code: string, name: string): boolean {
  return /usg|usm|ultras|ультраз|узи/.test(`${code} ${name}`.toLowerCase());
}

export type BonusLine = {
  practitionerId: string;
  name: string;
  staffKind: string;
  turnover: number;
  bonus: number;
};

export type BonusMonth = {
  from: string;
  to: string;
  netPercent: number;
  lines: BonusLine[];
  fundTurnover: number;
  fundBonus: number;
  total: number;
};

export async function computeBonusMonth(from: string, to: string): Promise<BonusMonth> {
  const schedule = await loadBonusSchedule();
  const factor = netFactor(schedule);
  const { start } = bakuDayBounds(from);
  const { end } = bakuDayBounds(to);

  const [procedures, labs, visits, catalog, people] = await Promise.all([
    prisma.procedureOrder.findMany({
      where: { status: "COMPLETED", completedAt: { gte: start, lt: end } },
      select: {
        procedureCode: true,
        procedureName: true,
        amountNet: true,
        patientOrigin: true,
        prescribedByPractitionerId: true,
        preferredPractitionerId: true,
      },
    }),
    prisma.labOrder.findMany({
      where: { status: { in: ["COMPLETED", "PUBLISHED"] }, completedAt: { gte: start, lt: end } },
      select: {
        testCode: true,
        amountNet: true,
        patientOrigin: true,
        prescribedByPractitionerId: true,
        items: { select: { serviceCode: true } },
      },
    }),
    prisma.visit.findMany({
      where: { status: "COMPLETED", completedAt: { gte: start, lt: end } },
      select: {
        amountNet: true,
        patientOrigin: true,
        practitionerId: true,
        serviceLines: { select: { serviceCode: true, description: true, amount: true } },
      },
    }),
    prisma.serviceCatalogCache.findMany({ select: { code: true, amount: true } }),
    prisma.practitioner.findMany({
      where: { active: true, staffKind: { in: ["DOCTOR", "MASSAGE", "LAB"] } },
      select: { id: true, fullName: true, staffKind: true },
    }),
  ]);

  const priceByCode = new Map(catalog.map((row) => [row.code, Number(row.amount)]));
  const personById = new Map(people.map((row) => [row.id, row]));

  const buckets = new Map<string, { turnover: number; bonus: number }>();
  const add = (id: string | null | undefined, turnover: number, bonus: number) => {
    if (!id || !personById.has(id) || (bonus <= 0 && turnover <= 0)) return;
    const row = buckets.get(id) ?? { turnover: 0, bonus: 0 };
    row.turnover += turnover;
    row.bonus += bonus;
    buckets.set(id, row);
  };
  const creditPair = (
    price: number,
    referId: string | null | undefined,
    referBonus: number,
    performId: string | null | undefined,
    performBonus: number,
  ) => {
    const same = Boolean(referId && referId === performId);
    if (referId) add(referId, price, referBonus);
    if (performId) add(performId, same ? 0 : price, performBonus);
  };
  const coef = (id: string) => (schedule.coefficients[id] ?? 100) / 100;

  let allTurnover = 0;
  let poolTurnover = 0;

  for (const order of procedures) {
    const performer = personById.get(order.preferredPractitionerId ?? "");
    const code = order.procedureCode;
    const massage = performer?.staffKind === "MASSAGE" || categoryOfProcedure(code, order.procedureName) === "massage";
    const category = massage ? "massage" : performer?.staffKind === "DOCTOR" ? categoryOfProcedure(code, order.procedureName) : null;
    if (!category) continue;
    const list = priceByCode.get(code) ?? 0;
    const price = Number(order.amountNet) > 0 ? Number(order.amountNet) : list;
    if (!(price > 0)) continue;
    allTurnover += price;
    if (category === "massage") poolTurnover += price;
    const rates = (order.patientOrigin === "WALK_IN" ? schedule.walkIn : schedule.inHouse)[category];
    creditPair(
      price,
      order.prescribedByPractitionerId,
      price * factor * (rates.refer / 100) * coef(order.prescribedByPractitionerId ?? ""),
      order.preferredPractitionerId,
      price * factor * (rates.perform / 100) * coef(order.preferredPractitionerId ?? ""),
    );
  }

  for (const lab of labs) {
    const list = priceByCode.get(lab.testCode) ?? 0;
    const price = Number(lab.amountNet) > 0 ? Number(lab.amountNet) : list;
    if (!(price > 0)) continue;
    allTurnover += price;
    const codes = [lab.testCode, ...lab.items.map((item) => item.serviceCode)].join(" ");
    const ultra = isUltrasound(codes, codes);
    poolTurnover += price;
    const category = ultra ? "func" : "lab";
    const owner = ultra ? schedule.usPractitionerId : schedule.labPractitionerId;
    const rates = (lab.patientOrigin === "WALK_IN" ? schedule.walkIn : schedule.inHouse)[category];
    creditPair(
      price,
      lab.prescribedByPractitionerId,
      price * factor * (rates.refer / 100) * coef(lab.prescribedByPractitionerId ?? ""),
      owner,
      price * factor * (rates.perform / 100) * coef(owner ?? ""),
    );
  }

  for (const visit of visits) {
    const lines = visit.serviceLines;
    const hay = lines.map((line) => `${line.serviceCode} ${line.description}`).join(" ");
    const listed = lines.reduce((sum, line) => sum + (Number(line.amount) > 0 ? Number(line.amount) : priceByCode.get(line.serviceCode) ?? 0), 0);
    const price = Number(visit.amountNet) > 0 ? Number(visit.amountNet) : listed;
    if (!(price > 0)) continue;
    const ultra = isUltrasound(hay, hay);
    const category = ultra ? "func" : categoryOfProcedure(hay, hay);
    if (!category) continue;
    allTurnover += price;
    if (ultra || category === "massage") poolTurnover += price;
    const rates = (visit.patientOrigin === "WALK_IN" ? schedule.walkIn : schedule.inHouse)[category];
    const owner = ultra ? schedule.usPractitionerId : visit.practitionerId;
    if (owner) add(owner, price, price * factor * (rates.perform / 100) * coef(owner));
  }

  const lines: BonusLine[] = [...buckets.entries()]
    .map(([id, row]) => {
      const person = personById.get(id)!;
      return {
        practitionerId: id,
        name: person.fullName,
        staffKind: person.staffKind,
        turnover: round2(row.turnover),
        bonus: round2(row.bonus),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const fundTurnover = Math.max(0, allTurnover - poolTurnover);
  const fundBonus = round2(fundTurnover * factor * (schedule.fundPercent / 100));
  const total = round2(lines.reduce((sum, line) => sum + line.bonus, 0) + fundBonus);
  return {
    from,
    to,
    netPercent: Math.round((100 - schedule.vatPercent - schedule.profitTaxPercent) * 100) / 100,
    lines,
    fundTurnover: round2(fundTurnover),
    fundBonus,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
