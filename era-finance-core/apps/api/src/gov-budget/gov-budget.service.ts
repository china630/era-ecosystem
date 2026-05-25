import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BudgetYearStatus,
  Decimal,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import { CheckBudgetLimitDto } from "./dto/check-budget-limit.dto";
import { CreateBudgetYearDto } from "./dto/create-budget-year.dto";

@Injectable()
export class GovBudgetService {
  constructor(private readonly prisma: PrismaService) {}

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
      note: "Fact reflects commitments only; ledger postings are a future phase.",
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
