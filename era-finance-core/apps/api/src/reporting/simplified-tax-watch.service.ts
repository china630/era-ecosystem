import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CounterpartyKind,
  Decimal,
  EqaimeStatus,
  InvoiceStatus,
  Prisma,
} from "@erafinance/database";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { PrismaService } from "../prisma/prisma.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import {
  AccountingBookService,
  ledgerTypeForBookGaap,
} from "../accounting/accounting-book.service";
import {
  computeSimplifiedWatch,
  monthEndYmd,
  monthStartYmd,
  parseSchemeParams,
  quarterBounds,
  rollingTwelveMonthStart,
  type SchemeParams,
  type TaxRegimeFamily,
  type TenderBucket,
  type TenderLine,
} from "./simplified-tax-watch.calc";

const PERIOD = /^(\d{4})-(\d{2})$/;

function asRegime(value: unknown): TaxRegimeFamily {
  if (value === "PROFIT" || value === "PROFIT_VAT" || value === "SIMPLIFIED") return value;
  return "SIMPLIFIED";
}

function civilDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

@Injectable()
export class SimplifiedTaxWatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: PostingAccountResolver,
    private readonly accountingBooks: AccountingBookService,
  ) {}

  async listSchemes() {
    return this.prisma.taxSchemeVersion.findMany({
      orderBy: [{ effectiveFrom: "asc" }, { code: "asc" }],
    });
  }

  async watch(organizationId: string, period: string) {
    const parsed = PERIOD.exec(period.trim());
    if (!parsed) throw new BadRequestException("period must be YYYY-MM");
    const year = Number(parsed[1]);
    const month = Number(parsed[2]);
    if (month < 1 || month > 12) throw new BadRequestException("period must be YYYY-MM");

    const periodStart = monthStartYmd(year, month);
    const periodEnd = monthEndYmd(year, month);
    const windowStart = rollingTwelveMonthStart(periodEnd);
    const scheme = await this.schemeFor(periodStart, periodEnd);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) throw new BadRequestException("Organization not found");
    const tax =
      org.settings &&
      typeof org.settings === "object" &&
      !Array.isArray(org.settings) &&
      (org.settings as Record<string, unknown>).tax &&
      typeof (org.settings as Record<string, unknown>).tax === "object"
        ? ((org.settings as Record<string, unknown>).tax as Record<string, unknown>)
        : {};
    const regime = asRegime(tax.regime);
    const pricesIncludeTax = tax.pricesIncludeTax === true;

    const lines = await this.tenderLines(organizationId, windowStart, periodEnd);
    const quarter = quarterBounds(year, month);
    const invoices = await this.registeredInvoiceTotals(organizationId, quarter.start, quarter.end);

    return computeSimplifiedWatch({
      period,
      schemeCode: scheme.code,
      scheme: scheme.parameters,
      regime,
      pricesIncludeTax,
      lines,
      registeredInvoiceTotal: invoices.total,
      registeredInvoiceCovered: invoices.covered,
    });
  }

  async recomputedAmount(
    organizationId: string,
    period: string,
    taxType: string,
  ): Promise<{ amount: string; retroactive: boolean }> {
    if (taxType !== "SIMPLIFIED_TAX") {
      throw new BadRequestException("This button recomputes simplified tax from the scheme version");
    }
    const parsed = PERIOD.exec(period.trim());
    if (!parsed) throw new BadRequestException("Simplified tax period must be YYYY-MM");
    const year = Number(parsed[1]);
    const month = Number(parsed[2]);
    const scheme = await this.schemeFor(monthStartYmd(year, month), monthEndYmd(year, month));
    const watched = await this.watch(organizationId, period.trim());
    return { amount: watched.simplifiedTaxAmountAzn, retroactive: scheme.retroactive };
  }

  private async schemeFor(periodStart: string, periodEnd: string): Promise<{
    code: string;
    parameters: SchemeParams;
    retroactive: boolean;
  }> {
    const start = new Date(`${periodStart}T00:00:00.000Z`);
    const end = new Date(`${periodEnd}T00:00:00.000Z`);
    const row = await this.prisma.taxSchemeVersion.findFirst({
      where: {
        effectiveFrom: { lte: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!row) throw new BadRequestException("No tax scheme covers this period");
    const raw = row.parameters;
    const retroactive =
      !!raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      (raw as Record<string, unknown>).retroactive === true;
    return { code: row.code, parameters: parseSchemeParams(raw), retroactive };
  }

  private async tenderLines(
    organizationId: string,
    windowStart: string,
    periodEnd: string,
  ): Promise<TenderLine[]> {
    const [cashCode, bankCode, cardCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "CASH_AZN"),
      this.posting.resolveAccountCode(organizationId, "MAIN_BANK"),
      this.posting.resolveAccountCode(organizationId, "BANK_SETTLEMENT"),
    ]);
    const opsBook = await this.accountingBooks.resolveOpsBookForMoneyPath(organizationId);
    const ledgerType = ledgerTypeForBookGaap(opsBook.gaapKind);
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: opsBook.id,
        OR: [
          { code: { in: [cashCode, bankCode, cardCode] } },
          { code: { contains: "CARD", mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true },
    });
    const bucketOf = new Map<string, TenderBucket>();
    for (const account of accounts) {
      if (account.code === cashCode) bucketOf.set(account.id, "cash");
      else if (account.code === bankCode) bucketOf.set(account.id, "bank");
      else bucketOf.set(account.id, "card");
    }
    if (bucketOf.size === 0) return [];

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: opsBook.id,
        accountId: { in: [...bucketOf.keys()] },
        transaction: {
          date: {
            gte: new Date(`${windowStart}T00:00:00.000Z`),
            lte: new Date(`${periodEnd}T00:00:00.000Z`),
          },
        },
      },
      select: {
        id: true,
        accountId: true,
        debit: true,
        credit: true,
        transaction: { select: { date: true } },
        taxSettlementTag: { select: { population: true } },
      },
    });

    const lines: TenderLine[] = [];
    for (const entry of entries) {
      const bucket = bucketOf.get(entry.accountId);
      if (!bucket) continue;
      const amount = new Decimal(entry.debit).minus(entry.credit);
      if (amount.isZero()) continue;
      lines.push({
        date: civilDate(entry.transaction.date),
        bucket,
        population: bucket === "card" && entry.taxSettlementTag?.population === true,
        amount: amount.toFixed(4),
      });
    }
    return lines;
  }

  private async registeredInvoiceTotals(
    organizationId: string,
    startYmd: string,
    endYmd: string,
  ): Promise<{ total: string; covered: string }> {
    const { start } = bakuDayBounds(startYmd);
    const { end } = bakuDayBounds(endYmd);
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
      createdAt: { gte: start, lte: end },
      counterparty: {
        OR: [
          { kind: CounterpartyKind.LEGAL_ENTITY },
          { isVatPayer: true },
          { taxIdCipher: { not: null } },
        ],
      },
    };
    const [total, covered] = await Promise.all([
      this.prisma.invoice.aggregate({ where, _sum: { totalAmount: true } }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          OR: [
            { eqaimeStatus: EqaimeStatus.ACCEPTED },
            { eqaimeNumber: { not: null } },
          ],
        },
        _sum: { totalAmount: true },
      }),
    ]);
    return {
      total: (total._sum.totalAmount ?? new Decimal(0)).toFixed(4),
      covered: (covered._sum.totalAmount ?? new Decimal(0)).toFixed(4),
    };
  }
}
