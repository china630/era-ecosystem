import { BadRequestException, Injectable } from "@nestjs/common";
import {
  EmployeeKind,
  PayrollComponentKind,
  PayrollRunStatus,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";
import { batchEmployeePersonMap } from "../hr/employee-person.util";
import { monthRangeUtc } from "./reporting-period.util";

const Decimal = Prisma.Decimal;

export type PayrollWithholdingLine = {
  employeeId: string;
  kind: "EMPLOYEE" | "CONTRACTOR";
  displayName: string;
  fin: string | null;
  gross: Prisma.Decimal;
  incomeTax: Prisma.Decimal;
  dsmfWorker: Prisma.Decimal;
  dsmfEmployer: Prisma.Decimal;
  itsWorker: Prisma.Decimal;
  itsEmployer: Prisma.Decimal;
  unemploymentWorker: Prisma.Decimal;
  unemploymentEmployer: Prisma.Decimal;
  contractorSocialWithheld: Prisma.Decimal;
  pitTotal: Prisma.Decimal;
  socialTotal: Prisma.Decimal;
  slipLineDeductions: string;
  slipLineEarnings: string;
};

export type PayrollWithholdingAggregate = {
  period: string;
  periodFrom: string;
  periodTo: string;
  employees: PayrollWithholdingLine[];
  contractors: PayrollWithholdingLine[];
  totals: {
    pitTotal: string;
    socialTotal: string;
    dsmfWorker: string;
    dsmfEmployer: string;
    itsWorker: string;
    itsEmployer: string;
    unemploymentWorker: string;
    unemploymentEmployer: string;
    contractorSocialWithheld: string;
    grossTotal: string;
    slipLineDeductionsTotal: string;
    slipLineEarningsTotal: string;
  };
};

function parsePeriod(period: string): { year: number; month: number } {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new BadRequestException("period must be in YYYY-MM format");
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new BadRequestException("invalid period");
  }
  return { year, month };
}

function sumDecimal(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((s, v) => s.add(v), new Decimal(0));
}

function linePit(slip: {
  incomeTax: Prisma.Decimal;
}): Prisma.Decimal {
  return slip.incomeTax;
}

function lineSocial(slip: {
  dsmfWorker: Prisma.Decimal;
  dsmfEmployer: Prisma.Decimal;
  itsWorker: Prisma.Decimal;
  itsEmployer: Prisma.Decimal;
  unemploymentWorker: Prisma.Decimal;
  unemploymentEmployer: Prisma.Decimal;
  contractorSocialWithheld: Prisma.Decimal;
}): Prisma.Decimal {
  return slip.dsmfWorker
    .add(slip.dsmfEmployer)
    .add(slip.itsWorker)
    .add(slip.itsEmployer)
    .add(slip.unemploymentWorker)
    .add(slip.unemploymentEmployer)
    .add(slip.contractorSocialWithheld);
}

@Injectable()
export class PayrollWithholdingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: OrchestratorMdmClientService,
  ) {}

  async aggregate(
    organizationId: string,
    period: string,
  ): Promise<PayrollWithholdingAggregate> {
    const { year, month } = parsePeriod(period);
    const { start, end } = monthRangeUtc(year, month);

    const run = await this.prisma.payrollRun.findFirst({
      where: {
        organizationId,
        year,
        month,
        status: PayrollRunStatus.POSTED,
      },
      include: {
        slips: {
          include: {
            employee: {
              select: {
                id: true,
                kind: true,
                globalPersonId: true,
              },
            },
            lines: true,
          },
        },
      },
    });

    if (!run || run.slips.length === 0) {
      throw new BadRequestException(
        `No POSTED payroll run with slips for period ${period}`,
      );
    }

    const personIds = run.slips.map((s) => s.employee.globalPersonId);
    const personMap = await batchEmployeePersonMap(
      this.mdm,
      organizationId,
      personIds,
    );

    const employees: PayrollWithholdingLine[] = [];
    const contractors: PayrollWithholdingLine[] = [];
    let slipLineDeductionsTotal = new Decimal(0);
    let slipLineEarningsTotal = new Decimal(0);

    for (const slip of run.slips) {
      const person = personMap.get(slip.employee.globalPersonId);
      const displayName =
        person?.displayName?.trim() ||
        `${person?.lastName ?? "—"} ${person?.firstName ?? "—"}`.trim();
      const kind =
        slip.employee.kind === EmployeeKind.CONTRACTOR
          ? "CONTRACTOR"
          : "EMPLOYEE";

      const deductions = slip.lines
        .filter((l) => l.kind === PayrollComponentKind.DEDUCTION)
        .reduce((s, l) => s.add(l.amount), new Decimal(0));
      const earnings = slip.lines
        .filter((l) => l.kind === PayrollComponentKind.EARNING)
        .reduce((s, l) => s.add(l.amount), new Decimal(0));
      slipLineDeductionsTotal = slipLineDeductionsTotal.add(deductions);
      slipLineEarningsTotal = slipLineEarningsTotal.add(earnings);

      const line: PayrollWithholdingLine = {
        employeeId: slip.employee.id,
        kind,
        displayName,
        fin: person?.finMasked ?? null,
        gross: slip.gross,
        incomeTax: slip.incomeTax,
        dsmfWorker: slip.dsmfWorker,
        dsmfEmployer: slip.dsmfEmployer,
        itsWorker: slip.itsWorker,
        itsEmployer: slip.itsEmployer,
        unemploymentWorker: slip.unemploymentWorker,
        unemploymentEmployer: slip.unemploymentEmployer,
        contractorSocialWithheld: slip.contractorSocialWithheld,
        pitTotal: linePit(slip),
        socialTotal: lineSocial(slip),
        slipLineDeductions: deductions.toFixed(2),
        slipLineEarnings: earnings.toFixed(2),
      };
      if (kind === "CONTRACTOR") contractors.push(line);
      else employees.push(line);
    }

    const all = [...employees, ...contractors];
    return {
      period,
      periodFrom: start.toISOString().slice(0, 10),
      periodTo: end.toISOString().slice(0, 10),
      employees,
      contractors,
      totals: {
        pitTotal: sumDecimal(all.map((l) => l.pitTotal)).toFixed(2),
        socialTotal: sumDecimal(all.map((l) => l.socialTotal)).toFixed(2),
        dsmfWorker: sumDecimal(all.map((l) => l.dsmfWorker)).toFixed(2),
        dsmfEmployer: sumDecimal(all.map((l) => l.dsmfEmployer)).toFixed(2),
        itsWorker: sumDecimal(all.map((l) => l.itsWorker)).toFixed(2),
        itsEmployer: sumDecimal(all.map((l) => l.itsEmployer)).toFixed(2),
        unemploymentWorker: sumDecimal(
          all.map((l) => l.unemploymentWorker),
        ).toFixed(2),
        unemploymentEmployer: sumDecimal(
          all.map((l) => l.unemploymentEmployer),
        ).toFixed(2),
        contractorSocialWithheld: sumDecimal(
          all.map((l) => l.contractorSocialWithheld),
        ).toFixed(2),
        grossTotal: sumDecimal(all.map((l) => l.gross)).toFixed(2),
        slipLineDeductionsTotal: slipLineDeductionsTotal.toFixed(2),
        slipLineEarningsTotal: slipLineEarningsTotal.toFixed(2),
      },
    };
  }
}
