import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  Decimal,
  LedgerType,
  TimesheetEntryType,
  TimesheetStatus,
  TransactionMirrorStatus,
} from "@erafinance/database";
import { AccountingBookService } from "../accounting/accounting-book.service";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  getClosedPeriodKeys,
  monthKeyUtc,
} from "../reporting/reporting-period.util";
import { HrCalendarService } from "./hr-calendar.service";

function roundMoney2(v: Decimal): Decimal {
  return new Decimal(v.toFixed(2));
}

@Injectable()
export class MgmtLaborDeltaService {
  private readonly logger = new Logger(MgmtLaborDeltaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly accountingBooks: AccountingBookService,
    private readonly posting: PostingAccountResolver,
    private readonly calendar: HrCalendarService,
  ) {}

  /**
   * Rebuild idempotent MGMT labor deltas for an APPROVED timesheet month.
   * No pay UI / XML / cash — journal only into MANAGEMENT book.
   * Always stornos prior month JEs (including orphans) before rewrite.
   */
  async rebuild(
    organizationId: string,
    year: number,
    month: number,
  ): Promise<{
    year: number;
    month: number;
    posted: number;
    skipped: number;
    reversed: number;
    cleared: number;
    totalDelta: string;
  }> {
    if (month < 1 || month > 12) {
      throw new BadRequestException("month must be 1–12");
    }

    const timesheet = await this.prisma.timesheet.findFirst({
      where: { organizationId, year, month },
      select: { id: true, status: true },
    });
    if (!timesheet) {
      throw new NotFoundException("Timesheet not found for period");
    }
    if (timesheet.status !== TimesheetStatus.APPROVED) {
      throw new BadRequestException({
        code: "TIMESHEET_NOT_APPROVED",
        message: "MGMT labor delta requires an APPROVED timesheet",
      });
    }

    const mgmtBook = await this.accountingBooks.resolveManagementBook(
      organizationId,
    );
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const periodDate = new Date(Date.UTC(year, month, 0, 12, 0, 0, 0));
    const key = monthKeyUtc(periodDate);
    const closed = getClosedPeriodKeys(
      org?.settings,
      LedgerType.MANAGEMENT,
      mgmtBook.id,
    );
    if (closed.includes(key)) {
      throw new BadRequestException({
        code: "MGMT_PERIOD_CLOSED",
        message: `MGMT period ${key} is closed; NAS is untouched`,
      });
    }

    const normDays = await this.calendar.countWorkingDaysInMonth(year, month);
    const monthNormHours = new Decimal(Math.max(normDays, 1) * 8);

    const existing = await this.prisma.mgmtLaborDelta.findMany({
      where: { organizationId, year, month },
    });

    // Wave 5 gap-fix: reverse ALL prior month JEs first (orphans when rate cleared).
    let reversed = 0;
    for (const prev of existing) {
      if (!prev.transactionId) continue;
      await this.reversePriorJournal(
        organizationId,
        prev.transactionId,
        periodDate,
        mgmtBook.id,
      );
      reversed += 1;
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        deletedAt: null,
        internalRate: { not: null, gt: 0 },
      },
      select: {
        id: true,
        salary: true,
        internalRate: true,
      },
    });
    const empById = new Map(employees.map((e) => [e.id, e]));

    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        timesheetId: timesheet.id,
        type: TimesheetEntryType.WORK,
        deletedAt: null,
      },
      select: { employeeId: true, hours: true },
    });
    const workHoursByEmp = new Map<string, Decimal>();
    for (const e of entries) {
      const prev = workHoursByEmp.get(e.employeeId) ?? new Decimal(0);
      workHoursByEmp.set(e.employeeId, prev.add(e.hours));
    }

    const slips = await this.prisma.payrollSlip.findMany({
      where: {
        organizationId,
        payrollRun: { organizationId, year, month },
      },
      select: { employeeId: true, gross: true },
    });
    const slipGrossByEmp = new Map(
      slips.map((s) => [s.employeeId, new Decimal(s.gross)]),
    );

    const expenseCode = await this.posting.resolveAccountCode(
      organizationId,
      "PAYROLL_EXPENSE",
    );
    const payableCode = await this.posting.resolveAccountCode(
      organizationId,
      "PAYROLL_PAYABLE",
    );

    let posted = 0;
    let skipped = 0;
    let cleared = 0;
    let totalDelta = new Decimal(0);
    const keptEmployeeIds = new Set<string>();

    for (const emp of employees) {
      const rate = emp.internalRate ? new Decimal(emp.internalRate) : null;
      if (!rate || rate.lte(0)) {
        skipped += 1;
        continue;
      }
      const workHours = workHoursByEmp.get(emp.id) ?? new Decimal(0);
      if (workHours.lte(0)) {
        skipped += 1;
        continue;
      }

      const ratio = workHours.div(monthNormHours);
      const mgmtGross = roundMoney2(rate.mul(ratio));
      const slipGross = slipGrossByEmp.get(emp.id);
      const statGross = roundMoney2(
        slipGross ?? new Decimal(emp.salary).mul(ratio),
      );
      const delta = Decimal.max(new Decimal(0), mgmtGross.sub(statGross));

      let transactionId: string | null = null;
      if (delta.gt(0)) {
        const { transactionId: tid } = await this.prisma.$transaction(
          async (tx) => {
            const result = await this.accounting.postJournalInTransaction(tx, {
              organizationId,
              date: periodDate,
              reference: `MGMT-LABOR-${year}-${String(month).padStart(2, "0")}-${emp.id.slice(0, 8)}`,
              description: `MGMT labor delta ${month}/${year}`,
              isFinal: true,
              ledgerType: LedgerType.MANAGEMENT,
              accountingBookId: mgmtBook.id,
              lines: [
                {
                  accountCode: expenseCode,
                  debit: delta.toString(),
                  credit: 0,
                },
                {
                  accountCode: payableCode,
                  debit: 0,
                  credit: delta.toString(),
                },
              ],
            });
            await tx.transaction.update({
              where: { id: result.transactionId },
              data: { mirrorStatus: TransactionMirrorStatus.NONE },
            });
            return result;
          },
        );
        transactionId = tid;
        posted += 1;
        totalDelta = totalDelta.add(delta);
      } else {
        skipped += 1;
      }

      keptEmployeeIds.add(emp.id);
      await this.prisma.mgmtLaborDelta.upsert({
        where: {
          organizationId_year_month_employeeId: {
            organizationId,
            year,
            month,
            employeeId: emp.id,
          },
        },
        create: {
          organizationId,
          year,
          month,
          employeeId: emp.id,
          workHours,
          monthNormHours,
          mgmtGross,
          statGross,
          delta,
          accountingBookId: mgmtBook.id,
          transactionId,
        },
        update: {
          workHours,
          monthNormHours,
          mgmtGross,
          statGross,
          delta,
          accountingBookId: mgmtBook.id,
          transactionId,
        },
      });
    }

    // Clear orphan rows (rate removed / no WORK hours) after storno.
    for (const prev of existing) {
      if (keptEmployeeIds.has(prev.employeeId)) continue;
      if (empById.has(prev.employeeId)) {
        // Still in rate set but skipped (no hours) — zero the row.
        await this.prisma.mgmtLaborDelta.update({
          where: { id: prev.id },
          data: {
            workHours: new Decimal(0),
            monthNormHours,
            mgmtGross: new Decimal(0),
            statGross: new Decimal(0),
            delta: new Decimal(0),
            transactionId: null,
          },
        });
      } else {
        await this.prisma.mgmtLaborDelta.delete({ where: { id: prev.id } });
      }
      cleared += 1;
    }

    this.logger.log(
      `MgmtLaborDelta rebuild org=${organizationId} ${year}-${month}: posted=${posted} skipped=${skipped} reversed=${reversed} cleared=${cleared}`,
    );

    return {
      year,
      month,
      posted,
      skipped,
      reversed,
      cleared,
      totalDelta: totalDelta.toFixed(2),
    };
  }

  async list(organizationId: string, year: number, month: number) {
    return this.prisma.mgmtLaborDelta.findMany({
      where: { organizationId, year, month },
      orderBy: { employeeId: "asc" },
    });
  }

  private async reversePriorJournal(
    organizationId: string,
    transactionId: string,
    date: Date,
    accountingBookId: string,
  ) {
    const original = await this.prisma.transaction.findFirst({
      where: { id: transactionId, organizationId },
      include: {
        journalEntries: {
          include: { account: { select: { code: true } } },
        },
      },
    });
    if (!original) return;

    // Already reversed?
    const existingRev = await this.prisma.transaction.findFirst({
      where: { organizationId, reversesTransactionId: transactionId },
      select: { id: true },
    });
    if (existingRev) return;

    const lines = original.journalEntries.map((je) => ({
      accountCode: je.account.code,
      debit: Number(je.credit),
      credit: Number(je.debit),
    }));
    if (lines.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date,
        reference: `REV-${original.reference ?? transactionId.slice(0, 8)}`,
        description: `Storno MGMT labor delta`,
        isFinal: true,
        ledgerType: LedgerType.MANAGEMENT,
        accountingBookId,
        reversesTransactionId: transactionId,
        lines,
      });
    });
  }
}
