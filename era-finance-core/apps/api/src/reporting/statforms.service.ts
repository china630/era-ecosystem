import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import {
  EmployeeEmploymentStatus,
  LedgerType,
  ManufacturingOrderStatus,
  PayrollRunStatus,
  Prisma,
  StatReportExportStatus,
  StatReportPeriodKind,
  StockMovementReason,
  StockMovementType,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { ReportingService } from "./reporting.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { STORAGE_SERVICE, type StorageService } from "../storage/storage.interface";
import { statReportXlsxBuffer } from "../reports/report-export.util";
import {
  monthRangeUtc,
  parseIsoDateOnly,
  yearRangeUtc,
  endOfUtcDay,
} from "./reporting-period.util";
import { upsertStatReportDefinitions } from "./stat-report-definitions.seed";
import type { GenerateStatReportDto } from "./dto/generate-stat-report.dto";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

type MappingSection = {
  lineCode: string;
  source?: string;
  accountPrefix?: string;
  metric?: string;
  filter?: string;
  constant?: number | string;
  value?: number | string;
};

type ComputedLine = {
  lineCode: string;
  source: string;
  metric?: string;
  amount: string;
};

function parseStatPeriod(
  periodKind: StatReportPeriodKind,
  period: string,
): { fromStr: string; toStr: string; periodLabel: string } {
  if (periodKind === StatReportPeriodKind.YEAR) {
    const year = Number(period);
    if (!Number.isFinite(year) || period.length !== 4) {
      throw new BadRequestException("YEAR period must be YYYY");
    }
    const range = yearRangeUtc(year);
    return { fromStr: range.fromStr, toStr: range.toStr, periodLabel: period };
  }
  if (periodKind === StatReportPeriodKind.MONTH) {
    const m = period.match(/^(\d{4})-(\d{2})$/);
    if (!m) throw new BadRequestException("MONTH period must be YYYY-MM");
    const year = Number(m[1]);
    const month = Number(m[2]);
    const { start, end } = monthRangeUtc(year, month);
    const fromStr = start.toISOString().slice(0, 10);
    const toStr = end.toISOString().slice(0, 10);
    return { fromStr, toStr, periodLabel: period };
  }
  const qm = period.match(/^(\d{4})-Q([1-4])$/i);
  if (!qm) {
    throw new BadRequestException("QUARTER period must be YYYY-Qn");
  }
  const year = Number(qm[1]);
  const quarter = Number(qm[2]);
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const { start } = monthRangeUtc(year, startMonth);
  const { end } = monthRangeUtc(year, endMonth);
  return {
    fromStr: start.toISOString().slice(0, 10),
    toStr: end.toISOString().slice(0, 10),
    periodLabel: period.toUpperCase(),
  };
}

@Injectable()
export class StatformsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService,
    private readonly subscription: SubscriptionAccessService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.statReportDefinition.count();
    if (count === 0) {
      await upsertStatReportDefinitions(this.prisma);
    }
  }

  async assertAccess(
    organizationId: string,
    opts?: { userEmail?: string | null; isSuperAdmin?: boolean },
  ): Promise<void> {
    if (opts?.isSuperAdmin) return;
    const compliance = await this.subscription.hasModule(
      organizationId,
      ModuleEntitlement.COMPLIANCE_PRO,
      opts?.userEmail,
      opts?.isSuperAdmin,
    );
    if (compliance) return;
    const tax = await this.subscription.hasModule(
      organizationId,
      ModuleEntitlement.TAX_PRO,
      opts?.userEmail,
      opts?.isSuperAdmin,
    );
    if (tax) return;
    throw new ForbiddenException({
      code: "STAT_FORMS_MODULE_REQUIRED",
      message:
        "Statistical forms require compliance_pro or tax_pro module entitlement",
    });
  }

  async listDefinitions() {
    return this.prisma.statReportDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        periodKind: true,
        version: true,
        updatedAt: true,
      },
    });
  }

  async listExports(organizationId: string) {
    return this.prisma.statReportExport.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        definition: {
          select: { code: true, name: true, periodKind: true },
        },
      },
    });
  }

  async generate(organizationId: string, dto: GenerateStatReportDto) {
    const definition = await this.prisma.statReportDefinition.findFirst({
      where: { code: dto.definitionCode, isActive: true },
    });
    if (!definition) {
      throw new NotFoundException("Stat report definition not found");
    }

    const { fromStr, toStr, periodLabel } = parseStatPeriod(
      definition.periodKind,
      dto.period,
    );
    const mapping = definition.mappingJson as { sections?: MappingSection[] };
    const sections = Array.isArray(mapping?.sections) ? mapping.sections : [];

    const lines: ComputedLine[] = [];
    for (const section of sections) {
      const amount = await this.resolveSectionValue(
        organizationId,
        section,
        fromStr,
        toStr,
      );
      lines.push({
        lineCode: section.lineCode,
        source: section.source ?? "UNKNOWN",
        metric: section.metric,
        amount: amount.toString(),
      });
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    const xlsx = await statReportXlsxBuffer({
      definitionCode: definition.code,
      definitionName: definition.name,
      period: periodLabel,
      dateFrom: fromStr,
      dateTo: toStr,
      orgName: org.name,
      lines,
    });

    const fileKey = `orgs/${organizationId}/stat-reports/${definition.code}/${periodLabel}-${Date.now()}.xlsx`;
    await this.storage.putObject(fileKey, xlsx, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const created = await this.prisma.statReportExport.create({
      data: {
        organizationId,
        definitionId: definition.id,
        period: periodLabel,
        fileUrl: fileKey,
        status: StatReportExportStatus.GENERATED,
      },
      include: {
        definition: {
          select: { code: true, name: true, periodKind: true },
        },
      },
    });

    return { ...created, lines };
  }

  async download(organizationId: string, exportId: string) {
    const row = await this.prisma.statReportExport.findFirst({
      where: { id: exportId, organizationId },
      include: { definition: { select: { code: true } } },
    });
    if (!row) {
      throw new NotFoundException("Stat report export not found");
    }
    const buffer = await this.storage.getObject(row.fileUrl);
    return {
      buffer,
      filename: `${row.definition.code}-${row.period}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  private normalizeSource(source?: string): string {
    const s = (source ?? "").trim().toUpperCase();
    if (s === "GL_ACCOUNT_PREFIX") return "GL_TURNOVER";
    if (s === "STOCK_QTY") return "INVENTORY_ISSUE";
    if (s === "PAYROLL_HEADCOUNT") return "HR_HEADCOUNT";
    if (s === "CONSTANT") return "CONSTANT";
    return s.replace(/\./g, "_").replace(/-/g, "_");
  }

  private async resolveSectionValue(
    organizationId: string,
    section: MappingSection,
    fromStr: string,
    toStr: string,
  ): Promise<Decimal> {
    const source = this.normalizeSource(section.source);
    const metric = (section.metric ?? "").toLowerCase();

    if (source === "CONSTANT") {
      const raw = section.constant ?? section.value ?? 0;
      return new Decimal(String(raw));
    }

    if (source === "GL_TURNOVER" || source === "GL_ACCOUNT_PREFIX") {
      const prefix = section.accountPrefix ?? "";
      const tb = await this.reporting.trialBalance(
        organizationId,
        fromStr,
        toStr,
        LedgerType.NAS,
      );
      let total = new Decimal(0);
      for (const row of tb.rows) {
        if (!row.accountCode.startsWith(prefix)) continue;
        total = total
          .add(new Decimal(row.periodDebit))
          .add(new Decimal(row.periodCredit));
      }
      return total;
    }

    if (source === "HR_HEADCOUNT" || source === "PAYROLL_HEADCOUNT") {
      const end = parseIsoDateOnly(toStr);
      const count = await this.prisma.employee.count({
        where: {
          organizationId,
          employmentStatus: EmployeeEmploymentStatus.ACTIVE,
          deletedAt: null,
          hireDate: { lte: end },
        },
      });
      return new Decimal(count);
    }

    if (source === "HR_PAYROLL") {
      const { year, month } = this.monthFromPeriodEnd(toStr);
      const run = await this.prisma.payrollRun.findFirst({
        where: {
          organizationId,
          year,
          month,
          status: PayrollRunStatus.POSTED,
        },
        include: { slips: true },
      });
      if (!run) return new Decimal(0);
      return run.slips.reduce((sum, s) => sum.add(s.gross), new Decimal(0));
    }

    if (source === "HR_ABSENCE") {
      const start = parseIsoDateOnly(fromStr);
      const end = parseIsoDateOnly(toStr);
      const absences = await this.prisma.absence.findMany({
        where: {
          organizationId,
          startDate: { lte: end },
          endDate: { gte: start },
          deletedAt: null,
        },
        select: { startDate: true, endDate: true },
      });
      return absences.reduce((sum, a) => {
        const days =
          Math.floor(
            (a.endDate.getTime() - a.startDate.getTime()) / 86_400_000,
          ) + 1;
        return sum.add(Math.max(days, 0));
      }, new Decimal(0));
    }

    if (
      source === "INVENTORY_ISSUE" ||
      source === "INVENTORY_RECEIPT" ||
      source === "STOCK_QTY"
    ) {
      const type =
        source === "INVENTORY_RECEIPT"
          ? StockMovementType.IN
          : StockMovementType.OUT;
      const reason =
        type === StockMovementType.IN
          ? StockMovementReason.RECEIPT
          : StockMovementReason.SHIPMENT;
      const from = parseIsoDateOnly(fromStr);
      const to = parseIsoDateOnly(toStr);
      const agg = await this.prisma.stockMovement.aggregate({
        where: {
          organizationId,
          type,
          reason,
          documentDate: { gte: from, lte: to },
        },
        _sum: { quantity: true },
      });
      return new Decimal(String(agg._sum.quantity ?? 0));
    }

    if (source === "MANUFACTURING_RELEASE") {
      const from = parseIsoDateOnly(fromStr);
      const to = parseIsoDateOnly(toStr);
      const orders = await this.prisma.manufacturingOrder.findMany({
        where: {
          organizationId,
          completedAt: { gte: from, lte: to },
          status: ManufacturingOrderStatus.COMPLETED,
        },
        select: { quantity: true },
      });
      return orders.reduce((sum, o) => sum.add(o.quantity), new Decimal(0));
    }

    if (source === "PRICELIST") {
      // PriceList model not on this branch yet
      return new Decimal(0);
    }

    if (source === "INVOICE") {
      const from = parseIsoDateOnly(fromStr);
      const to = endOfUtcDay(parseIsoDateOnly(toStr));
      const items = await this.prisma.invoiceItem.findMany({
        where: {
          invoice: {
            organizationId,
            createdAt: { gte: from, lte: to },
          },
        },
        select: { unitPrice: true },
      });
      if (items.length === 0) return new Decimal(0);
      const total = items.reduce(
        (sum, i) => sum.add(i.unitPrice),
        new Decimal(0),
      );
      return total.div(items.length);
    }

    if (source === "PURCHASE") {
      const from = parseIsoDateOnly(fromStr);
      const to = parseIsoDateOnly(toStr);
      const entries = await this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          transaction: {
            date: { gte: from, lte: to },
            isFinal: true,
            reference: "PURCHASE_INVOICE",
          },
        },
        select: { debit: true },
      });
      if (entries.length === 0) return new Decimal(0);
      const total = entries.reduce(
        (sum, e) => sum.add(e.debit),
        new Decimal(0),
      );
      return total.div(entries.length);
    }

    void metric;
    return new Decimal(0);
  }

  private monthFromPeriodEnd(toStr: string): { year: number; month: number } {
    const d = parseIsoDateOnly(toStr);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }
}
