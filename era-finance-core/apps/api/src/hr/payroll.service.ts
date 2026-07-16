import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import PDFDocument from "pdfkit";
import {
  Decimal,
  EmployeeKind,
  OrganizationKind,
  PayrollComponentCode,
  PayrollComponentKind,
  PayrollRunStatus,
  UserRole,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";
import { PayrollHeavyQueueService } from "./payroll-heavy.queue";
import { AbsencesService } from "./absences.service";
import type { SickPayCalcDto } from "./dto/sick-pay-calc.dto";
import { TimesheetService } from "./timesheet.service";
import { PAYROLL_ENTITY_ASYNC_THRESHOLD } from "./payroll.constants";
import {
  calculateContractorMicroPayrollTax,
  calculatePayrollByTemplateGroup,
  parsePayrollTaxSettings,
} from "../payroll/tax-calculator";
import { roundMoney2 } from "./payroll-calculator";
import { BankingGatewayService } from "../banking/banking-gateway.service";
import { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";
import { batchEmployeePersonMap } from "./employee-person.util";
import { assertMayAccessPayrollFinance } from "../auth/policies/hr-payroll.policy";
import { NotificationService } from "../notifications/notification.service";
import {
  STORAGE_SERVICE,
  type StorageService,
} from "../storage/storage.interface";
import { MailService } from "../mail/mail.service";
import { PayrollComponentsService } from "./payroll-components.service";
import {
  PDF_FONT_UNICODE,
  PDF_FONT_UNICODE_BOLD,
  registerUnicodeFonts,
} from "../reporting/pdf-font.util";

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly payrollQueue: PayrollHeavyQueueService,
    private readonly timesheet: TimesheetService,
    private readonly absences: AbsencesService,
    private readonly bankingGateway: BankingGatewayService,
    private readonly config: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly notifications: NotificationService,
    private readonly posting: PostingAccountResolver,
    private readonly mdm: OrchestratorMdmClientService,
    private readonly mail: MailService,
    private readonly payrollComponents: PayrollComponentsService,
  ) {}

  listRuns(organizationId: string) {
    return this.prisma.payrollRun.findMany({
      where: { organizationId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { slips: true } } },
    });
  }

  listPayoutBankAccounts(organizationId: string) {
    return this.prisma.organizationBankAccount.findMany({
      where: { organizationId },
      orderBy: [{ bankName: "asc" }, { accountNumber: "asc" }],
    });
  }

  async getRun(organizationId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, organizationId },
      include: {
        slips: {
          include: {
            employee: true,
            lines: { orderBy: [{ kind: "asc" }, { code: "asc" }] },
          },
        },
      },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    const personMap = await batchEmployeePersonMap(
      this.mdm,
      organizationId,
      run.slips.map((s) => s.employee.globalPersonId),
    );
    return {
      ...run,
      slips: run.slips.map((s) => {
        const p = personMap.get(s.employee.globalPersonId);
        return {
          ...s,
          employee: {
            ...s.employee,
            firstName: p?.firstName ?? "—",
            lastName: p?.lastName ?? "—",
            finCode: p?.finCode ?? null,
          },
        };
      }),
    };
  }

  /**
   * Синхронное создание черновика (используется worker’ом и при N ≤ порога).
   */
  async createDraftRunSync(organizationId: string, dto: CreatePayrollRunDto) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        organizationId_year_month: {
          organizationId,
          year: dto.year,
          month: dto.month,
        },
      },
    });
    if (existing) {
      throw new ConflictException("Payroll run already exists for this month");
    }

    const [employees, org, componentIdByCode] = await Promise.all([
      this.prisma.employee.findMany({
        where: { organizationId },
        include: { workSchedule: true },
      }),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.payrollComponents.componentIdMap(organizationId),
    ]);
    if (employees.length === 0) {
      throw new BadRequestException("No employees to pay");
    }
    const personMap = await batchEmployeePersonMap(
      this.mdm,
      organizationId,
      employees.map((e) => e.globalPersonId),
    );
    const taxSettings = parsePayrollTaxSettings(org?.settings);
    const templateGroup = this.resolveTemplateGroup(org?.settings);

    let tsSummary: Awaited<
      ReturnType<TimesheetService["summarizeForPayroll"]>
    > | null = null;
    if (dto.timesheetId) {
      tsSummary = await this.timesheet.summarizeForPayroll(
        dto.timesheetId,
        organizationId,
      );
      if (tsSummary.year !== dto.year || tsSummary.month !== dto.month) {
        throw new BadRequestException(
          "Табель не соответствует выбранному месяцу ведомости",
        );
      }
    }

    const linesByEmployee = new Map<
      string,
      Array<{
        code: PayrollComponentCode;
        amount: number;
        note?: string;
      }>
    >();
    for (const line of dto.employeeLines ?? []) {
      const list = linesByEmployee.get(line.employeeId) ?? [];
      list.push(line);
      linesByEmployee.set(line.employeeId, list);
    }

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          organizationId,
          year: dto.year,
          month: dto.month,
          status: PayrollRunStatus.DRAFT,
          timesheetId: dto.timesheetId ?? undefined,
        },
      });

      for (const emp of employees) {
        const tariff = new Decimal(
          (emp as { tariffSalary?: Decimal }).tariffSalary ?? 0,
        );
        const supplement = new Decimal(
          (emp as { supplementSalary?: Decimal }).supplementSalary ?? 0,
        );
        let grossBase =
          tariff.add(supplement).gt(0)
            ? tariff.add(supplement)
            : new Decimal(emp.salary);

        if (
          emp.kind === EmployeeKind.EMPLOYEE &&
          tsSummary?.mixByEmployeeId[emp.id]
        ) {
          const m = tsSummary.mixByEmployeeId[emp.id];
          grossBase = await this.absences.adjustGrossForStampedTimesheetMonth(
            organizationId,
            emp.id,
            grossBase,
            tsSummary.year,
            tsSummary.month,
            m,
          );
        }

        const slipLineDrafts: Array<{
          code: PayrollComponentCode;
          kind: PayrollComponentKind;
          amount: Decimal;
          note: string;
          componentId: string | null;
        }> = [];

        const pushLine = (
          code: PayrollComponentCode,
          amount: Decimal,
          note = "",
        ) => {
          if (amount.lte(0) && code !== PayrollComponentCode.BASE_SALARY) {
            return;
          }
          const kind = this.payrollComponents.kindForCode(code);
          slipLineDrafts.push({
            code,
            kind,
            amount: roundMoney2(amount),
            note,
            componentId: componentIdByCode.get(code) ?? null,
          });
        };

        pushLine(PayrollComponentCode.BASE_SALARY, grossBase);

        const hoursRow = tsSummary?.hoursByEmployeeId?.[emp.id];
        const schedule = emp.workSchedule;
        if (hoursRow && schedule && emp.kind === EmployeeKind.EMPLOYEE) {
          const normDays = Math.max(1, tsSummary?.normWorkingDays ?? 21);
          const dayHours = new Decimal(schedule.dayHours || 8);
          const monthlyHours = dayHours.mul(normDays);
          const hourly = monthlyHours.gt(0)
            ? grossBase.div(monthlyHours)
            : new Decimal(0);
          // Premium differential: hours × hourly × (rate − 1)
          const nightExtra = hourly
            .mul(hoursRow.night)
            .mul(new Decimal(schedule.nightPremiumRate).sub(1));
          const eveningExtra = hourly
            .mul(hoursRow.evening)
            .mul(new Decimal(schedule.eveningPremiumRate).sub(1));
          const otExtra = hourly
            .mul(hoursRow.overtime)
            .mul(new Decimal(schedule.overtimePremiumRate).sub(1));
          pushLine(PayrollComponentCode.NIGHT_PREMIUM, nightExtra);
          pushLine(PayrollComponentCode.EVENING_PREMIUM, eveningExtra);
          pushLine(PayrollComponentCode.OVERTIME_PREMIUM, otExtra);
        }

        for (const manual of linesByEmployee.get(emp.id) ?? []) {
          pushLine(
            manual.code,
            new Decimal(manual.amount),
            manual.note?.trim() ?? "",
          );
        }

        let earnings = new Decimal(0);
        let deductions = new Decimal(0);
        let taxRelief = new Decimal(0);
        for (const line of slipLineDrafts) {
          if (line.code === PayrollComponentCode.BASE_SALARY) continue;
          if (line.code === PayrollComponentCode.INCOME_TAX_RELIEF) {
            taxRelief = taxRelief.add(line.amount);
            continue;
          }
          if (line.kind === PayrollComponentKind.EARNING) {
            earnings = earnings.add(line.amount);
          } else {
            deductions = deductions.add(line.amount);
          }
        }

        const taxableGross = roundMoney2(
          grossBase.add(earnings).sub(taxRelief),
        );
        if (taxableGross.isNegative()) {
          throw new BadRequestException(
            `Negative taxable gross for employee ${emp.id}`,
          );
        }

        const b =
          emp.kind === EmployeeKind.CONTRACTOR
            ? calculateContractorMicroPayrollTax(
                taxableGross,
                emp.contractorMonthlySocialAzn,
              )
            : calculatePayrollByTemplateGroup(
                taxableGross,
                templateGroup,
                taxSettings,
              );

        const statutoryWorker = roundMoney2(
          b.incomeTax
            .add(b.dsmfWorker)
            .add(b.itsWorker)
            .add(b.unemploymentWorker)
            .add(b.contractorSocialWithheld),
        );
        const net = roundMoney2(
          taxableGross.sub(statutoryWorker).sub(deductions),
        );

        if (net.isNegative()) {
          const p = personMap.get(emp.globalPersonId);
          throw new BadRequestException(
            `Отрицательная сумма к выплате для сотрудника ${p?.lastName ?? emp.id}: проверьте оклад и удержания`,
          );
        }

        const ts = tsSummary?.byEmployeeId[emp.id];
        const slip = await tx.payrollSlip.create({
          data: {
            organizationId,
            payrollRunId: run.id,
            employeeId: emp.id,
            gross: b.gross,
            incomeTax: b.incomeTax,
            dsmfWorker: b.dsmfWorker,
            dsmfEmployer: b.dsmfEmployer,
            itsWorker: b.itsWorker,
            itsEmployer: b.itsEmployer,
            unemploymentWorker: b.unemploymentWorker,
            unemploymentEmployer: b.unemploymentEmployer,
            contractorSocialWithheld: b.contractorSocialWithheld,
            net,
            timesheetWorkDays: ts?.work ?? null,
            timesheetVacationDays: ts?.vacation ?? null,
            timesheetSickDays: ts?.sick ?? null,
            timesheetBusinessTripDays: ts?.businessTrip ?? null,
          },
        });

        if (slipLineDrafts.length > 0) {
          await tx.payrollSlipLine.createMany({
            data: slipLineDrafts.map((line) => ({
              organizationId,
              payrollSlipId: slip.id,
              componentId: line.componentId,
              code: line.code,
              kind: line.kind,
              amount: line.amount,
              note: line.note,
            })),
          });
        }
      }

      return tx.payrollRun.findUniqueOrThrow({
        where: { id: run.id },
        include: {
          slips: {
            include: {
              employee: true,
              lines: true,
            },
          },
        },
      });
    });
  }

  /**
   * При большом числе сотрудников — очередь BullMQ, иначе синхронно.
   */
  async createDraftRun(
    organizationId: string,
    dto: CreatePayrollRunDto,
  ): Promise<
    | { async: true; jobId: string }
    | Awaited<ReturnType<PayrollService["createDraftRunSync"]>>
  > {
    const employees = await this.prisma.employee.findMany({
      where: { organizationId },
      select: { id: true },
    });
    if (employees.length > PAYROLL_ENTITY_ASYNC_THRESHOLD) {
      const jobId = await this.payrollQueue.enqueueDraft(organizationId, dto);
      return { async: true, jobId };
    }
    return this.createDraftRunSync(organizationId, dto);
  }

  /**
   * Переводит `PayrollRun` в **POSTED** (без проводок ГК).
   * NAS-проводки по ЗП создаются при **`SalaryRegistry → PAID`**: см. `markSalaryRegistryPaid`
   * (штат: 721/533/521; ГПХ: 721/531/521 — TZ §12.3).
   */
  async postRunSync(organizationId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: { slips: true },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new ConflictException("Payroll run already posted");
    }
    if (run.slips.length === 0) {
      throw new BadRequestException("No slips");
    }

    await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: PayrollRunStatus.POSTED,
      },
    });

    return this.getRun(organizationId, run.id);
  }

  /**
   * При большом числе листов — очередь BullMQ.
   */
  async postRun(
    organizationId: string,
    runId: string,
  ): Promise<
    | { async: true; jobId: string }
    | Awaited<ReturnType<PayrollService["postRunSync"]>>
  > {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: { _count: { select: { slips: true } } },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run._count.slips > PAYROLL_ENTITY_ASYNC_THRESHOLD) {
      const jobId = await this.payrollQueue.enqueuePost(organizationId, runId);
      return { async: true, jobId };
    }
    return this.postRunSync(organizationId, runId);
  }

  /**
   * TZ §7.0: xəstəlik üzrə işəgötürən hissəsi (14 günədək, staj %) — tam məntiqi `AbsencesService`.
   */
  previewSickLeavePay(organizationId: string, dto: SickPayCalcDto) {
    return this.absences.calculateSickPay(organizationId, dto);
  }

  /**
   * TZ §7.0: əmək məzuniyyəti / 30.4 — tam məntiqi `AbsencesService`.
   */
  previewLaborLeavePay(
    organizationId: string,
    employeeId: string,
    vacationStart: string,
    vacationEnd: string,
    absenceTypeId?: string,
  ) {
    return this.absences.calculateVacationPay(
      organizationId,
      employeeId,
      vacationStart,
      vacationEnd,
      absenceTypeId,
    );
  }

  async createAndPrepareSalaryRegistry(
    organizationId: string,
    payrollRunId: string,
    params: {
      bankAccountId: string;
      payoutFormat?: "ABB_XML" | "UNIVERSAL_XLSX";
    },
    actingUserRole: UserRole,
  ) {
    assertMayAccessPayrollFinance(actingUserRole);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, organizationId },
      include: { slips: true },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.POSTED) {
      throw new BadRequestException("Payroll run must be POSTED before payout");
    }
    const bankAccount = await this.prisma.organizationBankAccount.findFirst({
      where: { id: params.bankAccountId, organizationId },
    });
    if (!bankAccount) throw new BadRequestException("Bank account not found");
    const payoutFormat =
      params.payoutFormat ??
      (bankAccount.bankName.toLowerCase().includes("abb")
        ? "ABB_XML"
        : "UNIVERSAL_XLSX");

    const created = await (this.prisma as any).salaryRegistry.create({
      data: {
        organizationId,
        payrollRunId,
        bankAccountId: bankAccount.id,
        payoutFormat,
        status: "DRAFT",
      },
    });
    const prepared = await this.bankingGateway.prepareSalaryRegistry(
      created.id,
      actingUserRole,
    );
    return prepared;
  }

  listRunSalaryRegistries(organizationId: string, payrollRunId: string) {
    return (this.prisma as any).salaryRegistry.findMany({
      where: { organizationId, payrollRunId },
      include: { bankAccount: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async markSalaryRegistryPaid(
    organizationId: string,
    registryId: string,
    opts?: { budgetLineId?: string },
  ) {
    const row = await (this.prisma as any).salaryRegistry.findFirst({
      where: { id: registryId, organizationId },
      include: {
        payrollRun: {
          include: {
            slips: {
              include: {
                employee: {
                  select: {
                    kind: true,
                    jobPosition: { select: { departmentId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Salary registry not found");
    if (row.status !== "SENT") {
      throw new BadRequestException("Only SENT registry can be marked as PAID");
    }

    const run = row.payrollRun as
      | {
          id: string;
          year: number;
          month: number;
          status: PayrollRunStatus;
          transactionId: string | null;
          slips: Array<{
            gross: Decimal;
            net: Decimal;
            incomeTax: Decimal;
            dsmfWorker: Decimal;
            itsWorker: Decimal;
            unemploymentWorker: Decimal;
            contractorSocialWithheld: Decimal;
            dsmfEmployer: Decimal;
            itsEmployer: Decimal;
            unemploymentEmployer: Decimal;
            employee: {
              kind: EmployeeKind;
              jobPosition: { departmentId: string | null } | null;
            };
          }>;
        }
      | undefined;
    if (!run) throw new BadRequestException("Payroll run not found for registry");
    if (run.status !== PayrollRunStatus.POSTED) {
      throw new BadRequestException("Payroll run must be POSTED before registry PAID");
    }

    const periodEnd = new Date(Date.UTC(run.year, run.month, 0, 12, 0, 0, 0));
    const refBase = `PAY-${run.year}-${String(run.month).padStart(2, "0")}`;

    const updatedRegistry = await this.prisma.$transaction(async (tx) => {
      /** First created GL transaction id when multiple departmental postings exist (backward-compatible link on PayrollRun). */
      let runTransactionId = run.transactionId;
      if (!runTransactionId) {
        type EmpBucket = {
          gross: Decimal;
          net: Decimal;
          pit521: Decimal;
          social523: Decimal;
          employerExpense: Decimal;
        };
        type ContrBucket = {
          gross: Decimal;
          pit521: Decimal;
          social523: Decimal;
        };
        const emptyEmp = (): EmpBucket => ({
          gross: new Decimal(0),
          net: new Decimal(0),
          pit521: new Decimal(0),
          social523: new Decimal(0),
          employerExpense: new Decimal(0),
        });
        const emptyContr = (): ContrBucket => ({
          gross: new Decimal(0),
          pit521: new Decimal(0),
          social523: new Decimal(0),
        });

        const buckets = new Map<
          string,
          {
            departmentId: string | null;
            emp: EmpBucket;
            contr: ContrBucket;
          }
        >();

        for (const s of run.slips) {
          const departmentId =
            s.employee.jobPosition?.departmentId ?? null;
          const key = departmentId ?? "__NO_DEPARTMENT__";
          const cur = buckets.get(key) ?? {
            departmentId,
            emp: emptyEmp(),
            contr: emptyContr(),
          };

          if (s.employee.kind === EmployeeKind.CONTRACTOR) {
            cur.contr.gross = cur.contr.gross.add(s.gross);
            cur.contr.pit521 = cur.contr.pit521.add(s.incomeTax);
            cur.contr.social523 = cur.contr.social523.add(s.contractorSocialWithheld);
          } else {
            cur.emp.gross = cur.emp.gross.add(s.gross);
            cur.emp.net = cur.emp.net.add(s.net);
            cur.emp.pit521 = cur.emp.pit521.add(s.incomeTax);
            cur.emp.social523 = cur.emp.social523
              .add(s.dsmfWorker)
              .add(s.dsmfEmployer)
              .add(s.itsWorker)
              .add(s.itsEmployer)
              .add(s.unemploymentWorker)
              .add(s.unemploymentEmployer);
            cur.emp.employerExpense = cur.emp.employerExpense
              .add(s.dsmfEmployer)
              .add(s.itsEmployer)
              .add(s.unemploymentEmployer);
          }
          buckets.set(key, cur);
        }

        const ordered = [...buckets.values()].sort((a, b) =>
          (a.departmentId ?? "").localeCompare(b.departmentId ?? ""),
        );
        const distinctDeptIds = [
          ...new Set(
            ordered
              .map((b) => b.departmentId)
              .filter((id): id is string => id != null && id !== ""),
          ),
        ];
        const departments =
          distinctDeptIds.length > 0
            ? await tx.department.findMany({
                where: { organizationId, id: { in: distinctDeptIds } },
                select: { id: true, name: true },
              })
            : [];
        const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

        const orgKind = await this.posting.getOrganizationKind(organizationId);
        let payrollExpenseCode = await this.posting.resolveAccountCode(
          organizationId,
          "PAYROLL_EXPENSE",
          tx,
        );
        if (opts?.budgetLineId && orgKind === OrganizationKind.BUDGET) {
          const budgetLine = await tx.budgetLine.findFirst({
            where: { id: opts.budgetLineId },
            include: { budgetYear: true },
          });
          if (
            !budgetLine ||
            budgetLine.budgetYear.organizationId !== organizationId
          ) {
            throw new NotFoundException("Budget line not found");
          }
          payrollExpenseCode = budgetLine.accountCode.trim();
        }
        const [payrollPayableCode, supplierPayableCode, payrollTaxPayableCode, socialPayableCode] =
          await Promise.all([
            this.posting.resolveAccountCode(organizationId, "PAYROLL_PAYABLE", tx),
            this.posting.resolveAccountCode(organizationId, "SUPPLIER_PAYABLE", tx),
            this.posting.resolveAccountCode(organizationId, "PAYROLL_TAX_PAYABLE", tx),
            this.posting.resolveAccountCode(organizationId, "PAYROLL_SOCIAL_PAYABLE", tx),
          ]);

        for (const [idx, b] of ordered.entries()) {
          const { emp, contr } = b;
          const cr521 = emp.pit521.add(contr.pit521);
          const cr523 = emp.social523.add(contr.social523);
          const contrWithholding = contr.pit521.add(contr.social523);
          const debit721 = emp.gross.add(emp.employerExpense).add(contr.gross);
          if (debit721.isZero() && cr521.isZero() && cr523.isZero()) {
            continue;
          }
          const deptLabel = b.departmentId
            ? (deptNameById.get(b.departmentId) ?? b.departmentId)
            : "без подразделения";

          const lines: Array<{
            accountCode: string;
            debit: string | number;
            credit: string | number;
          }> = [];

          if (emp.gross.gt(0)) {
            lines.push({
              accountCode: payrollExpenseCode,
              debit: emp.gross.toString(),
              credit: 0,
            });
          }
          if (emp.employerExpense.gt(0)) {
            lines.push({
              accountCode: payrollExpenseCode,
              debit: emp.employerExpense.toString(),
              credit: 0,
            });
          }
          if (contr.gross.gt(0)) {
            lines.push({
              accountCode: payrollExpenseCode,
              debit: contr.gross.toString(),
              credit: 0,
            });
          }
          if (emp.net.gt(0)) {
            lines.push({
              accountCode: payrollPayableCode,
              debit: 0,
              credit: emp.net.toString(),
            });
          }
          if (contr.gross.gt(0)) {
            lines.push({
              accountCode: supplierPayableCode,
              debit: 0,
              credit: contr.gross.toString(),
            });
          }
          if (contrWithholding.gt(0)) {
            lines.push({
              accountCode: supplierPayableCode,
              debit: contrWithholding.toString(),
              credit: 0,
            });
          }
          if (cr521.gt(0)) {
            lines.push({
              accountCode: payrollTaxPayableCode,
              debit: 0,
              credit: cr521.toString(),
            });
          }
          if (cr523.gt(0)) {
            lines.push({
              accountCode: socialPayableCode,
              debit: 0,
              credit: cr523.toString(),
            });
          }

          const { transactionId } = await this.accounting.postJournalInTransaction(
            tx,
            {
              organizationId,
              date: periodEnd,
              reference: `${refBase}-D${String(idx + 1).padStart(2, "0")}`,
              description: `Зарплата ${run.month}/${run.year} — ${deptLabel}`,
              isFinal: true,
              departmentId: b.departmentId ?? undefined,
              lines,
            },
          );
          if (!runTransactionId) {
            runTransactionId = transactionId;
          }
        }
      }

      await tx.payrollRun.update({
        where: { id: run.id },
        data: { transactionId: runTransactionId ?? undefined },
      });
      return (tx as any).salaryRegistry.update({
        where: { id: registryId },
        data: { status: "PAID" },
      });
    });

    await this.notifications.notifyFinanceUsers(organizationId, {
      title: "Зарплата",
      message:
        "Расчёт зарплаты завершён. Нажмите, чтобы посмотреть ведомость.",
      link: `/payroll?registryId=${registryId}`,
    });

    return updatedRegistry;
  }

  async createSalaryRegistryExportLink(
    organizationId: string,
    registryId: string,
    ttlSec = 900,
  ): Promise<{ url: string; expiresAt: string }> {
    const row = await (this.prisma as any).salaryRegistry.findFirst({
      where: { id: registryId, organizationId },
      select: { id: true, exportUrl: true },
    });
    if (!row?.exportUrl) {
      throw new NotFoundException("Export file is not ready");
    }
    const exp = Math.floor(Date.now() / 1000) + Math.max(60, ttlSec);
    const payload = `${organizationId}.${registryId}.${exp}`;
    const sig = this.signPayload(payload);
    return {
      url: `/api/hr/payroll/registries/${registryId}/export?exp=${exp}&sig=${sig}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async loadSalaryRegistryExportFile(
    organizationId: string,
    registryId: string,
    expRaw: string,
    sig: string,
  ): Promise<{ key: string; buffer: Buffer }> {
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException("Export link expired");
    }
    const payload = `${organizationId}.${registryId}.${exp}`;
    this.verifySignature(payload, sig);
    const row = await (this.prisma as any).salaryRegistry.findFirst({
      where: { id: registryId, organizationId },
      select: { exportUrl: true },
    });
    if (!row?.exportUrl) {
      throw new NotFoundException("Export file is not ready");
    }
    const buffer = await this.storage.getObject(row.exportUrl);
    return { key: row.exportUrl, buffer };
  }

  private resolveTemplateGroup(
    settingsRaw: unknown,
  ): "COMMERCIAL" | "GOVERNMENT" {
    const settings =
      settingsRaw && typeof settingsRaw === "object" && !Array.isArray(settingsRaw)
        ? (settingsRaw as Record<string, unknown>)
        : {};
    const direct = settings.templateGroup;
    if (direct === "GOVERNMENT" || direct === "COMMERCIAL") {
      return direct;
    }
    if (direct === "SMALL_BUSINESS") {
      return "COMMERCIAL";
    }
    const orgType = settings.organizationType;
    if (orgType === "GOVERNMENT") return "GOVERNMENT";
    return "COMMERCIAL";
  }

  async buildPayslipPdfBuffer(slip: {
    id: string;
    gross: Decimal;
    net: Decimal;
    incomeTax: Decimal;
    dsmfWorker: Decimal;
    itsWorker: Decimal;
    unemploymentWorker: Decimal;
    contractorSocialWithheld: Decimal;
    lines?: Array<{
      code: string;
      kind: string;
      amount: Decimal;
      note: string;
    }>;
    employee?: {
      firstName?: string;
      lastName?: string;
      tariffSalary?: Decimal | null;
      supplementSalary?: Decimal | null;
      salary?: Decimal;
    };
    payrollRun?: { year: number; month: number };
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    registerUnicodeFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));

    const name = `${slip.employee?.lastName ?? ""} ${slip.employee?.firstName ?? ""}`.trim() || "Employee";
    const period =
      slip.payrollRun != null
        ? `${String(slip.payrollRun.month).padStart(2, "0")}/${slip.payrollRun.year}`
        : "";

    doc.font(PDF_FONT_UNICODE_BOLD).fontSize(16).text("Payslip / Əmək haqqı vərəqəsi");
    doc.moveDown(0.5);
    doc.font(PDF_FONT_UNICODE).fontSize(11);
    doc.text(`Employee: ${name}`);
    if (period) doc.text(`Period: ${period}`);
    doc.moveDown(0.5);
    doc.text(`Gross: ${Number(slip.gross).toFixed(2)} AZN`);
    doc.text(`Income tax: ${Number(slip.incomeTax).toFixed(2)} AZN`);
    doc.text(`DSMF worker: ${Number(slip.dsmfWorker).toFixed(2)} AZN`);
    doc.text(`ITS worker: ${Number(slip.itsWorker).toFixed(2)} AZN`);
    doc.text(
      `Unemployment worker: ${Number(slip.unemploymentWorker).toFixed(2)} AZN`,
    );
    if (Number(slip.contractorSocialWithheld) > 0) {
      doc.text(
        `Contractor social: ${Number(slip.contractorSocialWithheld).toFixed(2)} AZN`,
      );
    }
    doc.font(PDF_FONT_UNICODE_BOLD).text(`Net: ${Number(slip.net).toFixed(2)} AZN`);

    if (slip.lines && slip.lines.length > 0) {
      doc.moveDown(0.75);
      doc.font(PDF_FONT_UNICODE_BOLD).text("Lines");
      doc.font(PDF_FONT_UNICODE);
      for (const line of slip.lines) {
        doc.text(
          `${line.kind} ${line.code}: ${Number(line.amount).toFixed(2)} AZN${line.note ? ` — ${line.note}` : ""}`,
        );
      }
    }

    doc.end();
    await new Promise<void>((resolve, reject) => {
      doc.on("end", () => resolve());
      doc.on("error", reject);
    });
    return Buffer.concat(chunks);
  }

  async emailSlip(
    organizationId: string,
    slipId: string,
    toEmail?: string,
  ): Promise<{ ok: boolean; sentTo?: string; skipped?: string }> {
    const slip = await this.prisma.payrollSlip.findFirst({
      where: { id: slipId, organizationId },
      include: {
        employee: { include: { linkedUser: true } },
        lines: true,
        payrollRun: true,
      },
    });
    if (!slip) throw new NotFoundException("Payroll slip not found");

    const personMap = await batchEmployeePersonMap(
      this.mdm,
      organizationId,
      [slip.employee.globalPersonId],
    );
    const person = personMap.get(slip.employee.globalPersonId);
    const enriched = {
      ...slip,
      employee: {
        ...slip.employee,
        firstName: person?.firstName ?? "—",
        lastName: person?.lastName ?? "—",
      },
    };

    const email =
      toEmail?.trim() ||
      slip.employee.linkedUser?.email?.trim() ||
      null;
    if (!email) {
      this.logger.log(
        `Payslip email skipped for slip ${slipId}: no email (MDM/linked user)`,
      );
      return { ok: false, skipped: "no_email" };
    }

    const pdf = await this.buildPayslipPdfBuffer(enriched);
    const period = `${String(slip.payrollRun.month).padStart(2, "0")}-${slip.payrollRun.year}`;
    await this.mail.sendMail({
      to: email,
      subject: `Payslip ${period}`,
      text: `Payslip for ${period} attached.`,
      attachments: [
        {
          filename: `payslip-${period}-${slip.id.slice(0, 8)}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
    return { ok: true, sentTo: email };
  }

  async emailRun(
    organizationId: string,
    runId: string,
  ): Promise<{
    sent: number;
    skipped: number;
    results: Array<{ slipId: string; ok: boolean; sentTo?: string; skipped?: string }>;
  }> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: { slips: { select: { id: true } } },
    });
    if (!run) throw new NotFoundException("Payroll run not found");

    const results: Array<{
      slipId: string;
      ok: boolean;
      sentTo?: string;
      skipped?: string;
    }> = [];
    let sent = 0;
    let skipped = 0;
    for (const s of run.slips) {
      const r = await this.emailSlip(organizationId, s.id);
      results.push({ slipId: s.id, ...r });
      if (r.ok) sent += 1;
      else skipped += 1;
    }
    return { sent, skipped, results };
  }

  private signPayload(payload: string): string {
    const secret =
      this.config.get<string>("PAYROLL_EXPORT_SIGN_SECRET") ||
      this.config.get<string>("JWT_SECRET") ||
      "payroll-export-dev-secret";
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  private verifySignature(payload: string, sig: string): void {
    const expected = this.signPayload(payload);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException("Invalid export signature");
    }
  }
}
