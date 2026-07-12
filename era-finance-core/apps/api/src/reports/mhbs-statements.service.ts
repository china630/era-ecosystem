import { BadRequestException, Injectable } from "@nestjs/common";
import { LedgerType, Prisma } from "@erafinance/database";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { ReportingService } from "../reporting/reporting.service";
import { PrismaService } from "../prisma/prisma.service";
import { CashFlowService } from "./cash-flow.service";
import {
  linesForForm,
  loadMhbsStatementCatalog,
  type MhbsForm,
  type MhbsStatementLineDef,
} from "./mhbs-statements-catalog.util";

type DecimalLike = Prisma.Decimal | number | string;
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export type MhbsStatementLine = {
  lineCode: string;
  labelAz: string;
  labelEn: string;
  amount: string;
  opening?: string;
  increase?: string;
  decrease?: string;
  closing?: string;
  isTotal?: boolean;
};

export type MhbsStatementPayload = {
  form: MhbsForm;
  ledgerType: LedgerType;
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  lines: MhbsStatementLine[];
  totals?: Record<string, string>;
  methodologyNote?: string;
};

function d(v: DecimalLike | null | undefined): Decimal {
  return new Decimal(v ?? 0);
}

function utcDateOnlyStr(s: string): string {
  return s.slice(0, 10);
}

function yearRangeUtc(year: number): { fromStr: string; toStr: string } {
  return { fromStr: `${year}-01-01`, toStr: `${year}-12-31` };
}

type TbRow = {
  accountCode: string;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
};

@Injectable()
export class MhbsStatementsService {
  constructor(
    private readonly reporting: ReportingService,
    private readonly posting: PostingAccountResolver,
    private readonly cashFlow: CashFlowService,
    private readonly prisma: PrismaService,
  ) {}

  async balanceSheet(
    organizationId: string,
    asOfDate: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ): Promise<MhbsStatementPayload> {
    const dateTo = utcDateOnlyStr(asOfDate);
    const tb = await this.reporting.trialBalance(
      organizationId,
      "1970-01-01",
      dateTo,
      ledgerType,
    );
    const catalog = await loadMhbsStatementCatalog();
    const defs = linesForForm(catalog, "BALANCE");
    const prefixMap = await this.resolveLinePrefixes(organizationId, defs);
    const lines = this.mapClosingBalanceLines(defs, tb.rows as TbRow[], prefixMap);
    return {
      form: "BALANCE",
      ledgerType,
      asOfDate: dateTo,
      lines,
      totals: {
        assets: lines.find((l) => l.lineCode === "200")?.amount ?? "0.00",
        liabilitiesEquity: lines.find((l) => l.lineCode === "500")?.amount ?? "0.00",
      },
    };
  }

  async incomeStatement(
    organizationId: string,
    dateFrom: string,
    dateTo: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ): Promise<MhbsStatementPayload> {
    const from = utcDateOnlyStr(dateFrom);
    const to = utcDateOnlyStr(dateTo);
    const stmt = await this.reporting.fullIncomeStatement(
      organizationId,
      from,
      to,
      ledgerType,
    );
    const catalog = await loadMhbsStatementCatalog();
    const defs = linesForForm(catalog, "PL");
    const periodRows = this.plRowsFromFullIncomeStatement(stmt);
    const lines = this.mapPeriodLines(defs, periodRows);
    return {
      form: "PL",
      ledgerType,
      dateFrom: from,
      dateTo: to,
      lines,
      totals: {
        revenue: lines.find((l) => l.lineCode === "630")?.amount ?? "0.0000",
        expenses: lines.find((l) => l.lineCode === "730")?.amount ?? "0.0000",
        netProfit: lines.find((l) => l.lineCode === "740")?.amount ?? stmt.accountingResult,
      },
      methodologyNote:
        "Mapped from fullIncomeStatement (6x/7x NAS accounts) to MoF P&L line codes.",
    };
  }

  async cashFlowStatement(
    organizationId: string,
    dateFrom: string,
    dateTo: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ): Promise<MhbsStatementPayload> {
    const from = utcDateOnlyStr(dateFrom);
    const to = utcDateOnlyStr(dateTo);
    const direct = await this.cashFlow.getDirectCashFlow(organizationId, {
      dateFrom: from,
      dateTo: to,
      ledgerType,
    });
    const catalog = await loadMhbsStatementCatalog();
    const defs = linesForForm(catalog, "CASH_FLOW");
    const sectionNet = new Map(
      direct.sections.map((s) => [s.section, s.net]),
    );
    const amountByCode = new Map<string, string>();
    for (const def of defs) {
      if (def.isTotal) continue;
      if (def.section) {
        amountByCode.set(def.lineCode, sectionNet.get(def.section) ?? "0.00");
      }
    }
    const lines: MhbsStatementLine[] = defs.map((def) => {
      let amount = amountByCode.get(def.lineCode);
      if (def.isTotal && def.sumLineCodes) {
        amount = def.sumLineCodes
          .reduce((sum, code) => sum.add(d(amountByCode.get(code) ?? 0)), new Decimal(0))
          .toFixed(2);
      }
      return {
        lineCode: def.lineCode,
        labelAz: def.labelAz,
        labelEn: def.labelEn,
        amount: amount ?? "0.00",
        isTotal: def.isTotal,
      };
    });
    return {
      form: "CASH_FLOW",
      ledgerType,
      dateFrom: from,
      dateTo: to,
      lines,
      totals: { netChange: lines.find((l) => l.lineCode === "840")?.amount ?? "0.00" },
      methodologyNote: direct.methodologyNote,
    };
  }

  async equityChanges(
    organizationId: string,
    year: number,
    ledgerType: LedgerType = LedgerType.NAS,
  ): Promise<MhbsStatementPayload> {
    if (!Number.isInteger(year) || year < 1970 || year > 2100) {
      throw new BadRequestException("year must be a valid calendar year");
    }
    const { fromStr, toStr } = yearRangeUtc(year);
    const tb = await this.reporting.trialBalance(
      organizationId,
      fromStr,
      toStr,
      ledgerType,
    );
    const catalog = await loadMhbsStatementCatalog();
    const defs = linesForForm(catalog, "EQUITY_CHANGES");
    const prefixMap = await this.resolveLinePrefixes(organizationId, defs);
    const lines = defs.map((def) => {
      const prefixes = prefixMap.get(def.lineCode) ?? def.nasPrefixes ?? [];
      const opening = this.sumClosingForPrefixes(
        tb.rows as TbRow[],
        prefixes,
        def,
        "opening",
      );
      const closing = this.sumClosingForPrefixes(
        tb.rows as TbRow[],
        prefixes,
        def,
        "closing",
      );
      const movement = closing.sub(opening);
      const increase = movement.gt(0) ? movement : new Decimal(0);
      const decrease = movement.lt(0) ? movement.neg() : new Decimal(0);
      return {
        lineCode: def.lineCode,
        labelAz: def.labelAz,
        labelEn: def.labelEn,
        amount: closing.toFixed(2),
        opening: opening.toFixed(2),
        increase: increase.toFixed(2),
        decrease: decrease.toFixed(2),
        closing: closing.toFixed(2),
      };
    });
    return {
      form: "EQUITY_CHANGES",
      ledgerType,
      year,
      dateFrom: fromStr,
      dateTo: toStr,
      lines,
    };
  }

  async notes(
    organizationId: string,
    asOfDate: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ): Promise<MhbsStatementPayload> {
    const dateTo = utcDateOnlyStr(asOfDate);
    const tb = await this.reporting.trialBalance(
      organizationId,
      "1970-01-01",
      dateTo,
      ledgerType,
    );
    const catalog = await loadMhbsStatementCatalog();
    const defs = linesForForm(catalog, "NOTES");
    const arTotal = this.sumClosingForPrefixes(
      tb.rows as TbRow[],
      ["211"],
      { sign: "debit" } as MhbsStatementLineDef,
      "closing",
    );
    const lines: MhbsStatementLine[] = defs.map((def) => {
      if (def.agingBucket) {
        const stubShare =
          def.agingBucket === "0_30" ? 0.6 : def.agingBucket === "31_90" ? 0.3 : 0.1;
        return {
          lineCode: def.lineCode,
          labelAz: def.labelAz,
          labelEn: def.labelEn,
          amount: arTotal.mul(stubShare).toFixed(2),
        };
      }
      const prefixes = def.nasPrefixes ?? [];
      const amount = this.sumClosingForPrefixes(
        tb.rows as TbRow[],
        prefixes,
        def,
        "closing",
      );
      return {
        lineCode: def.lineCode,
        labelAz: def.labelAz,
        labelEn: def.labelEn,
        amount: amount.toFixed(2),
      };
    });

    const faNbv = await this.fixedAssetsNbvFromRegister(organizationId);
    const n01 = lines.find((l) => l.lineCode === "N01");
    if (n01 && faNbv.gt(0)) {
      n01.amount = faNbv.toFixed(2);
    }

    return {
      form: "NOTES",
      ledgerType,
      asOfDate: dateTo,
      lines,
      methodologyNote:
        "Basic disclosure set. AR aging buckets are proportional stubs until invoice-level aging is wired.",
    };
  }

  async exportXlsx(payload: MhbsStatementPayload): Promise<Buffer> {
    const { mhbsStatementXlsxBuffer } = await import("./report-export.util");
    return mhbsStatementXlsxBuffer(payload);
  }

  async exportPdf(payload: MhbsStatementPayload): Promise<Buffer> {
    const { mhbsStatementPdfBuffer } = await import("./report-export.util");
    return mhbsStatementPdfBuffer(payload);
  }

  private async fixedAssetsNbvFromRegister(organizationId: string): Promise<Decimal> {
    const assets = await this.prisma.fixedAsset.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        purchasePrice: true,
        modernizationCost: true,
        bookedDepreciation: true,
      },
    });
    return assets.reduce((sum, a) => {
      const gross = d(a.purchasePrice).add(d(a.modernizationCost));
      const nbv = gross.sub(d(a.bookedDepreciation));
      return sum.add(Decimal.max(new Decimal(0), nbv));
    }, new Decimal(0));
  }

  private async resolveLinePrefixes(
    organizationId: string,
    defs: MhbsStatementLineDef[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    for (const def of defs) {
      const prefixes = new Set(def.nasPrefixes ?? []);
      if (def.postingRole) {
        prefixes.add(await this.posting.resolveAccountCode(organizationId, def.postingRole));
      }
      if (def.postingRoles) {
        for (const role of def.postingRoles) {
          prefixes.add(await this.posting.resolveAccountCode(organizationId, role));
        }
      }
      map.set(def.lineCode, [...prefixes]);
    }
    return map;
  }

  private plRowsFromFullIncomeStatement(stmt: {
    revenue: Array<{ accountCode: string; amount: string }>;
    expenses: Array<{ accountCode: string; amount: string }>;
  }): Array<{ accountCode: string; debit: Decimal; credit: Decimal }> {
    const rows: Array<{ accountCode: string; debit: Decimal; credit: Decimal }> = [];
    for (const r of stmt.revenue) {
      const amt = d(r.amount);
      rows.push({ accountCode: r.accountCode, debit: new Decimal(0), credit: amt });
    }
    for (const r of stmt.expenses) {
      const amt = d(r.amount);
      rows.push({ accountCode: r.accountCode, debit: amt, credit: new Decimal(0) });
    }
    return rows;
  }

  private mapClosingBalanceLines(
    defs: MhbsStatementLineDef[],
    tbRows: TbRow[],
    prefixMap: Map<string, string[]>,
  ): MhbsStatementLine[] {
    const amountByCode = new Map<string, Decimal>();
    for (const def of defs) {
      if (def.isTotal) continue;
      const prefixes = prefixMap.get(def.lineCode) ?? def.nasPrefixes ?? [];
      amountByCode.set(
        def.lineCode,
        this.sumClosingForPrefixes(tbRows, prefixes, def, "closing"),
      );
    }
    return this.finalizeLines(defs, amountByCode, 2);
  }

  private mapPeriodLines(
    defs: MhbsStatementLineDef[],
    periodRows: Array<{ accountCode: string; debit: Decimal; credit: Decimal }>,
  ): MhbsStatementLine[] {
    const amountByCode = new Map<string, Decimal>();
    for (const def of defs) {
      if (def.isTotal) continue;
      amountByCode.set(def.lineCode, this.sumPeriodForPrefixes(periodRows, def));
    }
    return this.finalizeLines(defs, amountByCode, 4);
  }

  private finalizeLines(
    defs: MhbsStatementLineDef[],
    amountByCode: Map<string, Decimal>,
    decimals: number,
  ): MhbsStatementLine[] {
    for (const def of defs) {
      if (!def.isTotal) continue;
      if (def.sumLineCodes) {
        const sum = def.sumLineCodes.reduce(
          (acc, code) => acc.add(amountByCode.get(code) ?? 0),
          new Decimal(0),
        );
        amountByCode.set(def.lineCode, sum);
      } else if (def.netOfLineCodes) {
        const creditSum = def.netOfLineCodes.credit.reduce(
          (acc, code) => acc.add(amountByCode.get(code) ?? 0),
          new Decimal(0),
        );
        const debitSum = def.netOfLineCodes.debit.reduce(
          (acc, code) => acc.add(amountByCode.get(code) ?? 0),
          new Decimal(0),
        );
        amountByCode.set(def.lineCode, creditSum.sub(debitSum));
      }
    }
    return defs.map((def) => ({
      lineCode: def.lineCode,
      labelAz: def.labelAz,
      labelEn: def.labelEn,
      amount: (amountByCode.get(def.lineCode) ?? new Decimal(0)).toFixed(decimals),
      isTotal: def.isTotal,
    }));
  }

  private sumClosingForPrefixes(
    tbRows: TbRow[],
    prefixes: string[],
    def: Pick<MhbsStatementLineDef, "sign" | "offsetPrefixes" | "excludePrefixes">,
    mode: "opening" | "closing",
  ): Decimal {
    let sum = new Decimal(0);
    for (const r of tbRows) {
      if (!this.accountMatchesPrefixes(r.accountCode, prefixes, def.excludePrefixes)) continue;
      const dr = d(mode === "opening" ? r.openingDebit : r.closingDebit);
      const cr = d(mode === "opening" ? r.openingCredit : r.closingCredit);
      sum = sum.add(this.signedNet(dr, cr, def.sign));
    }
    if (def.offsetPrefixes?.length) {
      for (const r of tbRows) {
        if (!this.accountMatchesPrefixes(r.accountCode, def.offsetPrefixes)) continue;
        const dr = d(mode === "opening" ? r.openingDebit : r.closingDebit);
        const cr = d(mode === "opening" ? r.openingCredit : r.closingCredit);
        sum = sum.sub(this.signedNet(dr, cr, def.sign === "debit" ? "credit" : "debit"));
      }
    }
    return sum;
  }

  private sumPeriodForPrefixes(
    rows: Array<{ accountCode: string; debit: Decimal; credit: Decimal }>,
    def: MhbsStatementLineDef,
  ): Decimal {
    let sum = new Decimal(0);
    for (const r of rows) {
      if (!this.accountMatchesPrefixes(r.accountCode, def.nasPrefixes ?? [], def.excludePrefixes)) {
        continue;
      }
      sum = sum.add(this.signedNet(r.debit, r.credit, def.sign));
    }
    return sum;
  }

  private accountMatchesPrefixes(
    accountCode: string,
    prefixes: string[],
    excludePrefixes?: string[],
  ): boolean {
    if (excludePrefixes?.some((p) => accountCode.startsWith(p))) return false;
    if (prefixes.length === 0) return false;
    return prefixes.some((p) => accountCode.startsWith(p));
  }

  private signedNet(dr: Decimal, cr: Decimal, sign: "debit" | "credit"): Decimal {
    return sign === "debit" ? dr.sub(cr) : cr.sub(dr);
  }
}
