import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  ProfitTaxAdjustmentKind,
  ProfitTaxAdjustmentSource,
  TaxRateKind,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { ReportingService } from "./reporting.service";
import { yearRangeUtc } from "./reporting-period.util";
import type { CreateProfitTaxAdjustmentDto } from "./dto/create-profit-tax-adjustment.dto";
import type { UpdateProfitTaxAdjustmentDto } from "./dto/update-profit-tax-adjustment.dto";

const Decimal = Prisma.Decimal;

const AUTO_TAX_DEPRECIATION_CODE = "AUTO_TAX_DEPRECIATION";

@Injectable()
export class ProfitTaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService,
  ) {}

  async listAdjustments(organizationId: string, year: number) {
    this.assertYear(year);
    await this.syncAutoTaxDepreciationAdjustment(organizationId, year);
    return this.prisma.profitTaxAdjustment.findMany({
      where: { organizationId, year, deletedAt: null },
      orderBy: [{ source: "asc" }, { code: "asc" }, { createdAt: "asc" }],
    });
  }

  async createManual(organizationId: string, dto: CreateProfitTaxAdjustmentDto) {
    this.assertYear(dto.year);
    return this.prisma.profitTaxAdjustment.create({
      data: {
        organizationId,
        year: dto.year,
        kind: dto.kind as ProfitTaxAdjustmentKind,
        code: dto.code.trim(),
        description: dto.description.trim(),
        amount: new Decimal(dto.amount),
        source: ProfitTaxAdjustmentSource.MANUAL,
      },
    });
  }

  async updateManual(
    organizationId: string,
    id: string,
    dto: UpdateProfitTaxAdjustmentDto,
  ) {
    const row = await this.findManualAdjustment(organizationId, id);
    return this.prisma.profitTaxAdjustment.update({
      where: { id: row.id },
      data: {
        ...(dto.kind != null ? { kind: dto.kind as ProfitTaxAdjustmentKind } : {}),
        ...(dto.code != null ? { code: dto.code.trim() } : {}),
        ...(dto.description != null ? { description: dto.description.trim() } : {}),
        ...(dto.amount != null ? { amount: new Decimal(dto.amount) } : {}),
      },
    });
  }

  async softDelete(organizationId: string, id: string) {
    const row = await this.findManualAdjustment(organizationId, id);
    return this.prisma.profitTaxAdjustment.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Auto book-to-tax line for depreciation difference (NK Art. 114).
   * Tax depreciation register is not yet on this branch — amount stays 0 until
   * FixedAssetTaxDepreciationMonth lands; book depreciation is still reported.
   */
  async syncAutoTaxDepreciationAdjustment(organizationId: string, year: number) {
    this.assertYear(year);
    const bookAgg = await this.prisma.fixedAssetDepreciationMonth.aggregate({
      where: { organizationId, year },
      _sum: { amount: true },
    });
    const bookDep = bookAgg._sum.amount ?? new Decimal(0);
    const taxDep = bookDep;
    const amount = taxDep.sub(bookDep);

    const existing = await this.prisma.profitTaxAdjustment.findFirst({
      where: {
        organizationId,
        year,
        source: ProfitTaxAdjustmentSource.AUTO_TAX_DEPRECIATION,
        deletedAt: null,
      },
    });

    const data = {
      kind: ProfitTaxAdjustmentKind.TEMPORARY,
      code: AUTO_TAX_DEPRECIATION_CODE,
      description:
        "Tax vs book depreciation difference (placeholder until tax depreciation register; currently 0)",
      amount,
    };

    if (existing) {
      return this.prisma.profitTaxAdjustment.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.profitTaxAdjustment.create({
      data: {
        organizationId,
        year,
        source: ProfitTaxAdjustmentSource.AUTO_TAX_DEPRECIATION,
        ...data,
      },
    });
  }

  async preview(organizationId: string, year: number) {
    return this.aggregateProfitTax(organizationId, year);
  }

  async aggregateProfitTax(organizationId: string, year: number) {
    this.assertYear(year);
    await this.syncAutoTaxDepreciationAdjustment(organizationId, year);

    const { fromStr, toStr } = yearRangeUtc(year);
    const stmt = await this.reporting.profitAndLoss(
      organizationId,
      fromStr,
      toStr,
    );
    const accountingResult = new Decimal(stmt.netProfit);

    const adjustments = await this.prisma.profitTaxAdjustment.findMany({
      where: { organizationId, year, deletedAt: null },
      orderBy: [{ source: "asc" }, { code: "asc" }],
    });

    let adjustmentsTotal = new Decimal(0);
    for (const adj of adjustments) {
      adjustmentsTotal = adjustmentsTotal.add(adj.amount);
    }

    const taxableBase = accountingResult.add(adjustmentsTotal);
    const taxRatePercent = await this.resolveProfitTaxRatePercent(year);
    const rateFraction = taxRatePercent.div(100);
    const taxAmount = taxableBase.gt(0)
      ? taxableBase.mul(rateFraction)
      : new Decimal(0);

    const bookAgg = await this.prisma.fixedAssetDepreciationMonth.aggregate({
      where: { organizationId, year },
      _sum: { amount: true },
    });
    const bookDep = bookAgg._sum.amount ?? new Decimal(0);

    return {
      year,
      periodFrom: fromStr,
      periodTo: toStr,
      accountingResult: accountingResult.toFixed(4),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        kind: a.kind,
        code: a.code,
        description: a.description,
        amount: a.amount.toFixed(4),
        source: a.source,
      })),
      adjustmentsTotal: adjustmentsTotal.toFixed(4),
      taxableBase: taxableBase.toFixed(4),
      taxRatePercent: taxRatePercent.toFixed(2),
      taxAmount: taxAmount.toFixed(4),
      bookDepreciationTotal: bookDep.toFixed(4),
      taxDepreciationTotal: bookDep.toFixed(4),
    };
  }

  private async resolveProfitTaxRatePercent(
    year: number,
  ): Promise<InstanceType<typeof Decimal>> {
    const asOf = new Date(Date.UTC(year, 11, 31, 0, 0, 0, 0));
    const row = await this.prisma.taxRate.findFirst({
      where: {
        code: "MENFEET_20",
        kind: TaxRateKind.INCOME,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (row) return new Decimal(row.percent);
    return new Decimal(20);
  }

  private async findManualAdjustment(organizationId: string, id: string) {
    const row = await this.prisma.profitTaxAdjustment.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException("Profit tax adjustment not found");
    }
    if (row.source !== ProfitTaxAdjustmentSource.MANUAL) {
      throw new BadRequestException("Only manual adjustments can be modified");
    }
    return row;
  }

  private assertYear(year: number) {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Invalid year (expected 2000–2100)");
    }
  }
}
