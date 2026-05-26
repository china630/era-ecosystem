import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BudgetYearStatus,
  Decimal,
  OrganizationKind,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PostingJournalBuilder } from "../accounting/posting/posting-journal-builder.service";
import { CheckBudgetLimitDto } from "./dto/check-budget-limit.dto";
import { CreateBudgetYearDto } from "./dto/create-budget-year.dto";
import type { RecordBudgetExpenseDto } from "./dto/record-budget-expense.dto";
import type { RecordBudgetFundingDto } from "./dto/record-budget-funding.dto";

function parseDateOnly(raw: string | undefined): Date {
  if (!raw?.trim()) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) throw new BadRequestException("date must be YYYY-MM-DD");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
}

@Injectable()
export class GovBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PostingAccountResolver,
    private readonly postingJournal: PostingJournalBuilder,
  ) {}

  private async assertBudgetOrganization(organizationId: string): Promise<void> {
    const kind = await this.resolver.getOrganizationKind(organizationId);
    if (kind !== OrganizationKind.BUDGET) {
      throw new BadRequestException(
        "Gov-budget ledger postings require a BUDGET organization",
      );
    }
  }

  async listYears(
    organizationId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.budgetYear.findMany({
        where,
        orderBy: [{ year: "desc" }, { version: "desc" }],
        skip,
        take: pageSize,
        include: { _count: { select: { lines: true } } },
      }),
      this.prisma.budgetYear.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async createYear(organizationId: string, dto: CreateBudgetYearDto) {
    const version = dto.version ?? 1;

    if (dto.lines?.length) {
      for (const line of dto.lines) {
        if (line.departmentId) {
          const dept = await this.prisma.department.findFirst({
            where: { id: line.departmentId, organizationId },
          });
          if (!dept) throw new NotFoundException("Department not found");
        }
      }
    }

    return this.prisma.budgetYear.create({
      data: {
        organizationId,
        year: dto.year,
        version,
        lines: dto.lines?.length
          ? {
              create: dto.lines.map((line) => ({
                accountCode: line.accountCode.trim(),
                departmentId: line.departmentId ?? null,
                limitAnnual: new Decimal(line.limitAnnual),
                limitMonthly: line.limitMonthly ?? undefined,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });
  }

  async getYear(organizationId: string, id: string) {
    const row = await this.prisma.budgetYear.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Budget year not found");
    return row;
  }

  async approveYear(organizationId: string, id: string) {
    const row = await this.getYear(organizationId, id);
    if (row.status !== BudgetYearStatus.DRAFT && row.status !== BudgetYearStatus.AMENDED) {
      throw new BadRequestException("Only DRAFT or AMENDED budget years can be approved");
    }
    return this.prisma.budgetYear.update({
      where: { id },
      data: { status: BudgetYearStatus.APPROVED },
    });
  }

  async amendYear(organizationId: string, id: string) {
    const row = await this.getYear(organizationId, id);
    if (row.status !== BudgetYearStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED budget years can be amended");
    }
    return this.prisma.budgetYear.update({
      where: { id },
      data: { status: BudgetYearStatus.AMENDED },
    });
  }

  async listLines(organizationId: string, budgetYearId: string) {
    await this.getYear(organizationId, budgetYearId);
    return this.prisma.budgetLine.findMany({
      where: { budgetYearId },
      orderBy: [{ accountCode: "asc" }],
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { commitments: true } },
      },
    });
  }

  async checkLimit(organizationId: string, dto: CheckBudgetLimitDto) {
    const line = await this.prisma.budgetLine.findFirst({
      where: { id: dto.budgetLineId },
      include: {
        budgetYear: true,
        commitments: true,
      },
    });
    if (!line || line.budgetYear.organizationId !== organizationId) {
      throw new NotFoundException("Budget line not found");
    }
    if (line.budgetYear.status !== BudgetYearStatus.APPROVED) {
      return {
        allowed: false,
        blocked: true,
        reason: "BUDGET_NOT_APPROVED",
        limitAnnual: line.limitAnnual.toFixed(4),
        committed: "0.0000",
        remaining: line.limitAnnual.toFixed(4),
        requested: new Decimal(dto.amount).toFixed(4),
      };
    }

    const requested = new Decimal(dto.amount);
    const committed = line.commitments.reduce(
      (sum, c) => sum.add(c.amount),
      new Decimal(0),
    );
    const limit = new Decimal(line.limitAnnual);
    const remaining = limit.sub(committed);
    const allowed = remaining.gte(requested);

    return {
      allowed,
      blocked: !allowed,
      reason: allowed ? null : "LIMIT_EXCEEDED",
      limitAnnual: limit.toFixed(4),
      committed: committed.toFixed(4),
      remaining: remaining.toFixed(4),
      requested: requested.toFixed(4),
    };
  }

  /** Records budget commitment against a posted document (purchase invoice, payment, etc.). */
  async documentUsage(
    organizationId: string,
    budgetLineId: string,
    amount: number | Decimal,
    referenceType: string,
    referenceId: string,
  ) {
    const line = await this.prisma.budgetLine.findFirst({
      where: { id: budgetLineId },
      include: { budgetYear: true },
    });
    if (!line || line.budgetYear.organizationId !== organizationId) {
      throw new NotFoundException("Budget line not found");
    }
    const commitment = await this.prisma.budgetCommitment.create({
      data: {
        budgetLineId,
        amount: new Decimal(amount.toString()),
        referenceType,
        referenceId,
      },
    });
    return commitment;
  }

  /**
   * Treasury funding received — Dr bank settlement / Cr budget funding (334).
   */
  async recordFundingReceipt(
    organizationId: string,
    dto: RecordBudgetFundingDto,
  ) {
    await this.assertBudgetOrganization(organizationId);
    if (dto.budgetYearId) {
      await this.getYear(organizationId, dto.budgetYearId);
    }
    const amount = new Prisma.Decimal(dto.amount);
    const date = parseDateOnly(dto.date);
    const reference = dto.reference?.trim() || `FUND-${Date.now()}`;
    const description =
      dto.description?.trim() ||
      `Budget funding receipt (${amount.toString()} AZN)`;

    return this.prisma.$transaction(async (tx) => {
      const { transactionId } = await this.postingJournal.postInTransaction(tx, {
        organizationId,
        schemaId: "BUDGET_APPROPRIATION",
        amounts: { main: amount },
        date,
        reference,
        description,
      });
      return { ok: true, transactionId, reference };
    });
  }

  /**
   * Budget expense execution — Dr budget line NAS / Cr bank settlement (103).
   */
  async recordExpenseExecution(
    organizationId: string,
    dto: RecordBudgetExpenseDto,
  ) {
    await this.assertBudgetOrganization(organizationId);
    const line = await this.prisma.budgetLine.findFirst({
      where: { id: dto.budgetLineId },
      include: { budgetYear: true },
    });
    if (!line || line.budgetYear.organizationId !== organizationId) {
      throw new NotFoundException("Budget line not found");
    }
    if (line.budgetYear.status !== BudgetYearStatus.APPROVED) {
      throw new BadRequestException("Budget year must be APPROVED");
    }

    const amount = new Prisma.Decimal(dto.amount);
    const check = await this.checkLimit(organizationId, {
      budgetLineId: dto.budgetLineId,
      amount: Number(amount.toString()),
    });
    if (!check.allowed) {
      throw new BadRequestException({
        code: check.reason ?? "BUDGET_LIMIT_EXCEEDED",
        message: "Budget line limit exceeded",
        ...check,
      });
    }

    const date = parseDateOnly(dto.date);
    const reference = dto.reference?.trim() || `EXEC-${Date.now()}`;
    const description =
      dto.description?.trim() ||
      `Budget execution ${line.accountCode} (${amount.toString()} AZN)`;

    return this.prisma.$transaction(async (tx) => {
      const { transactionId } = await this.postingJournal.postInTransaction(tx, {
        organizationId,
        schemaId: "BUDGET_EXPENSE_EXECUTION",
        amounts: { main: amount },
        date,
        reference,
        description,
        dynamicAccounts: { debitAccountCode: line.accountCode.trim() },
      });
      await tx.budgetCommitment.create({
        data: {
          budgetLineId: line.id,
          amount,
          referenceType: "BUDGET_EXPENSE_EXECUTION",
          referenceId: transactionId,
        },
      });
      return { ok: true, transactionId, reference, budgetLineId: line.id };
    });
  }

  async execution(organizationId: string, budgetYearId: string) {
    await this.getYear(organizationId, budgetYearId);
    const lines = await this.prisma.budgetLine.findMany({
      where: { budgetYearId },
      include: { commitments: true },
    });

    let planTotal = new Decimal(0);
    let factTotal = new Decimal(0);
    const lineItems = lines.map((line) => {
      const plan = new Decimal(line.limitAnnual);
      const fact = line.commitments.reduce(
        (sum, c) => sum.add(c.amount),
        new Decimal(0),
      );
      planTotal = planTotal.add(plan);
      factTotal = factTotal.add(fact);
      return {
        budgetLineId: line.id,
        accountCode: line.accountCode,
        departmentId: line.departmentId,
        plan: plan.toFixed(4),
        fact: fact.toFixed(4),
        remaining: plan.sub(fact).toFixed(4),
      };
    });

    return {
      budgetYearId,
      planTotal: planTotal.toFixed(4),
      factTotal: factTotal.toFixed(4),
      remainingTotal: planTotal.sub(factTotal).toFixed(4),
      lines: lineItems,
      note: "Fact includes commitments; use POST /gov-budget/funding and /gov-budget/expense-execution for ledger.",
    };
  }

  /** E-Smeta import stub — validates year exists, returns preview without persisting. */
  async importEsmetaStub(
    organizationId: string,
    budgetYearId: string,
    body: { lines?: { accountCode: string; limitAnnual: number }[] },
  ) {
    const year = await this.prisma.budgetYear.findFirst({
      where: { id: budgetYearId, organizationId },
    });
    if (!year) throw new NotFoundException("Budget year not found");
    const lines = body.lines ?? [];
    return {
      status: "PREVIEW",
      budgetYearId,
      lineCount: lines.length,
      lines,
      note: "E-Smeta full import + ЭЦП workflow — DEFERRED Phase 2",
    };
  }
}
