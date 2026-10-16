import { prisma } from "@/lib/prisma";

export type DayBlockStat = {
  free: number;
  paid: number;
  total: number;
  amount: number;
};

export type ExecutiveDayBlocks = {
  procedures: DayBlockStat;
  diagnostics: DayBlockStat;
  labs: DayBlockStat;
};

function emptyStat(): DayBlockStat {
  return { free: 0, paid: 0, total: 0, amount: 0 };
}

function addStat(stat: DayBlockStat, amount: number): void {
  const paid = amount > 0;
  if (paid) {
    stat.paid += 1;
    stat.amount += amount;
  } else {
    stat.free += 1;
  }
  stat.total += 1;
}

function isDiagnosticModality(kind: string | null | undefined, code: string | null | undefined): boolean {
  const foldedKind = (kind ?? "").toLowerCase();
  const foldedCode = (code ?? "").toUpperCase();
  return foldedKind === "imaging" || foldedKind === "functional" || foldedCode === "USG";
}

/** Paid lines are amount > 0. Package quota stays 0 and counts as free. */
export async function executiveDayBlocks(input: {
  from: Date;
  to: Date;
}): Promise<ExecutiveDayBlocks> {
  const procedures = emptyStat();
  const diagnostics = emptyStat();
  const labs = emptyStat();

  const [procedureRows, labRows] = await Promise.all([
    prisma.procedureOrder.findMany({
      where: {
        scheduledAt: { gte: input.from, lt: input.to },
        status: { not: "CANCELLED" },
      },
      select: { amountNet: true, inPackage: true },
    }),
    prisma.labOrder.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [
          { completedAt: { gte: input.from, lt: input.to } },
          { completedAt: null, createdAt: { gte: input.from, lt: input.to } },
        ],
      },
      select: {
        amountNet: true,
        testCode: true,
        items: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: {
            diagnosticService: {
              select: { modality: { select: { kind: true, code: true } } },
            },
          },
        },
      },
    }),
  ]);

  for (const row of procedureRows) {
    const amount = row.inPackage ? 0 : Number(row.amountNet);
    addStat(procedures, amount > 0 ? amount : 0);
  }
  for (const row of labRows) {
    const modality = row.items[0]?.diagnosticService?.modality;
    const diagnostic =
      isDiagnosticModality(modality?.kind, modality?.code) ||
      row.testCode.toUpperCase().startsWith("USG");
    addStat(diagnostic ? diagnostics : labs, Number(row.amountNet));
  }

  return { procedures, diagnostics, labs };
}
