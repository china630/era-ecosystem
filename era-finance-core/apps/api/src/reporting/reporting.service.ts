import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import {
  AccountType,
  CounterpartyRole,
  Decimal,
  DigitalSignatureStatus,
  EqaimeStatus,
  InvoiceStatus,
  LedgerType,
  OrganizationKind,
  pickAccountDisplayName,
  Prisma,
  SignedDocumentKind,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { DepreciationService } from "../fixed-assets/depreciation.service";
import { IntangibleAmortizationService } from "../intangible-assets/intangible-amortization.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  areAllMonthsClosed,
  endOfUtcDay,
  getClosedPeriodKeys,
  getClosedYearKeys,
  mergeClosedPeriod,
  mergeClosedYear,
  monthRangeUtc,
  parseIsoDateOnly,
  unmergeClosedPeriod,
  unmergeClosedYear,
  yearRangeUtc,
} from "./reporting-period.util";
import { verifyQrPublicBase } from "../common/verify-public-url";
import { reconciliationDocumentUuid } from "../signature/reconciliation-document-id";
import {
  buildCounterpartyReconciliationPayload,
  counterpartyReconciliationXlsxBuffer,
  type CounterpartyReconciliationOptions,
} from "./counterparty-reconciliation-build";
import { renderReconciliationPdfAz } from "./reconciliation-pdf.render";
import { decodeOrganizationTaxId, decryptText } from "../security/pii-crypto.util";
import { AccountingBookService } from "../accounting/accounting-book.service";

/**
 * Cash/Bank balances for dashboards — prefixes derived from posting roles
 * (CASH_AZN / CASH_FOREIGN / MAIN_BANK), not hard-coded NAS literals.
 */

function d(v: Decimal | null | undefined): Decimal {
  return v ?? new Decimal(0);
}

/** Чистая «дебетовая» позиция: Дт − Кт */
function netDrMinusCr(sumDr: Decimal, sumCr: Decimal): Decimal {
  return sumDr.sub(sumCr);
}

/** Для отображения: положительный нетто → колонка Дт, иначе Кт */
function splitDrCr(net: Decimal): { debit: Decimal; credit: Decimal } {
  if (net.gte(0)) {
    return { debit: net, credit: new Decimal(0) };
  }
  return { debit: new Decimal(0), credit: net.neg() };
}

function parseClosedPeriodEnd(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  return new Date(Date.UTC(y, month - 1, lastDay, 0, 0, 0, 0));
}

function absDelta(a: Decimal, b: Decimal): Decimal {
  const x = a.sub(b);
  return x.gte(0) ? x : x.neg();
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depreciation: DepreciationService,
    private readonly intangibleAmortization: IntangibleAmortizationService,
    private readonly config: ConfigService,
    private readonly posting: PostingAccountResolver,
    private readonly accounting: AccountingService,
    private readonly accountingBooks: AccountingBookService,
  ) {}

  private async resolveBookScope(
    organizationId: string,
    ledgerType: LedgerType,
    accountingBookId?: string,
  ): Promise<{ ledgerType: LedgerType; accountingBookId: string }> {
    const book = await this.accountingBooks.resolveByIdOrLedgerAlias(
      organizationId,
      accountingBookId,
      ledgerType,
    );
    return {
      accountingBookId: book.id,
      ledgerType:
        book.gaapKind === "IFRS"
          ? LedgerType.IFRS
          : book.gaapKind === "MANAGEMENT"
            ? LedgerType.MANAGEMENT
            : LedgerType.NAS,
    };
  }

  /** Account code prefixes for cash desks + bank from posting roles (FEAT-FC-COA-001). */
  private async cashBankCodePrefixes(
    organizationId: string,
  ): Promise<{ cashPrefixes: string[]; bankPrefixes: string[] }> {
    const kind = await this.posting.getOrganizationKind(organizationId);
    if (kind === OrganizationKind.BUDGET) {
      return { cashPrefixes: ["101"], bankPrefixes: ["103", "104"] };
    }
    // Q-01 / İ-05: 221 kassa, 223–224 bank. Do not expand 22x (221 is cash).
    return { cashPrefixes: ["221"], bankPrefixes: ["223", "224"] };
  }

  private async cashBankAccountWhere(
    organizationId: string,
    ledgerType: LedgerType,
    accountingBookId?: string,
  ): Promise<Prisma.AccountWhereInput> {
    const { cashPrefixes, bankPrefixes } = await this.cashBankCodePrefixes(
      organizationId,
    );
    return {
      organizationId,
      ledgerType,
      ...(accountingBookId ? { accountingBookId } : {}),
      OR: [
        ...cashPrefixes.map((p) => ({ code: { startsWith: p } })),
        ...bankPrefixes.map((p) => ({ code: { startsWith: p } })),
      ],
    };
  }

  async trialBalance(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    ledgerType = scope.ledgerType;
    const startedAt = Date.now();
    if (!dateFromStr?.trim() || !dateToStr?.trim()) {
      throw new BadRequestException("dateFrom and dateTo are required");
    }
    let dateFrom: Date;
    let dateTo: Date;
    try {
      dateFrom = parseIsoDateOnly(dateFromStr);
      dateTo = parseIsoDateOnly(dateToStr);
    } catch {
      throw new BadRequestException(
        "Invalid dateFrom/dateTo (expected YYYY-MM-DD)",
      );
    }
    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException("dateFrom must be <= dateTo");
    }

    const [revenueCode, cogsCode, payrollExpenseCode, fxGainCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "SALES_REVENUE"),
      this.posting.resolveAccountCode(organizationId, "COGS"),
      this.posting.resolveAccountCode(organizationId, "PAYROLL_EXPENSE"),
      this.posting.resolveAccountCode(organizationId, "FX_GAIN"),
    ]);

    const accounts = await this.prisma.account.findMany({
      where: { organizationId, ledgerType, accountingBookId: scope.accountingBookId },
      orderBy: { code: "asc" },
    });
    if (accounts.length === 0) {
      return {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        rows: [],
      };
    }

    const accountIds = accounts.map((a) => a.id);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closedKeys = getClosedPeriodKeys(
      org?.settings,
      ledgerType === LedgerType.IFRS ? "IFRS" : "NAS",
      scope.accountingBookId,
    );
    const closedEnds = closedKeys
      .map(parseClosedPeriodEnd)
      .filter((d): d is Date => d != null)
      .filter((d) => d.getTime() < dateFrom.getTime())
      .sort((a, b) => b.getTime() - a.getTime());
    const snapshotDate = closedEnds[0] ?? null;

    const periodAgg = await this.prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        accountId: { in: accountIds },
        transaction: {
          date: { gte: dateFrom, lte: dateTo },
          isFinal: true,
        },
      },
      _sum: { debit: true, credit: true },
    });

    let openingMap = new Map<string, { dr: Decimal; cr: Decimal }>();
    if (snapshotDate) {
      const snaps = await this.prisma.accountBalance.findMany({
        where: {
          organizationId,
          ledgerType,
          balanceDate: snapshotDate,
          accountId: { in: accountIds },
        },
        select: {
          accountId: true,
          debitBalance: true,
          creditBalance: true,
        },
      });
      openingMap = new Map(
        snaps.map((s) => [
          s.accountId,
          { dr: d(s.debitBalance), cr: d(s.creditBalance) },
        ]),
      );
      const missing = accountIds.filter((id) => !openingMap.has(id));
      if (missing.length > 0) {
        const fallbackAgg = await this.prisma.journalEntry.groupBy({
          by: ["accountId"],
          where: {
            organizationId,
            ledgerType,
            accountingBookId: scope.accountingBookId,
            accountId: { in: missing },
            transaction: { date: { lt: dateFrom }, isFinal: true },
          },
          _sum: { debit: true, credit: true },
        });
        for (const r of fallbackAgg) {
          openingMap.set(r.accountId, {
            dr: d(r._sum.debit),
            cr: d(r._sum.credit),
          });
        }
      }
    } else {
      const openingAgg = await this.prisma.journalEntry.groupBy({
        by: ["accountId"],
        where: {
          organizationId,
          ledgerType,
          accountingBookId: scope.accountingBookId,
          accountId: { in: accountIds },
          transaction: { date: { lt: dateFrom }, isFinal: true },
        },
        _sum: { debit: true, credit: true },
      });
      openingMap = new Map(
        openingAgg.map((r) => [
          r.accountId,
          {
            dr: d(r._sum.debit),
            cr: d(r._sum.credit),
          },
        ]),
      );
    }
    const periodMap = new Map(
      periodAgg.map((r) => [
        r.accountId,
        {
          dr: d(r._sum.debit),
          cr: d(r._sum.credit),
        },
      ]),
    );

    const rows = accounts.map((acc) => {
      const o = openingMap.get(acc.id) ?? { dr: new Decimal(0), cr: new Decimal(0) };
      const p = periodMap.get(acc.id) ?? { dr: new Decimal(0), cr: new Decimal(0) };
      const openingNet = netDrMinusCr(o.dr, o.cr);
      const periodDr = p.dr;
      const periodCr = p.cr;
      const closingNet = openingNet.add(periodDr).sub(periodCr);

      const ob = splitDrCr(openingNet);
      const cb = splitDrCr(closingNet);

      return {
        accountId: acc.id,
        accountCode: acc.code,
        accountName: pickAccountDisplayName(acc, "ru"),
        accountType: acc.type,
        openingDebit: ob.debit.toFixed(4),
        openingCredit: ob.credit.toFixed(4),
        periodDebit: periodDr.toFixed(4),
        periodCredit: periodCr.toFixed(4),
        closingDebit: cb.debit.toFixed(4),
        closingCredit: cb.credit.toFixed(4),
      };
    });

    const totalPeriodDebit = rows.reduce(
      (sum, r) => sum.add(new Decimal(r.periodDebit)),
      new Decimal(0),
    );
    const totalPeriodCredit = rows.reduce(
      (sum, r) => sum.add(new Decimal(r.periodCredit)),
      new Decimal(0),
    );
    const isBalanced = absDelta(totalPeriodDebit, totalPeriodCredit).lte(
      new Decimal("0.0001"),
    );

    const revenueRow = rows.find((r) => r.accountCode === revenueCode);
    const cogsRow = rows.find((r) => r.accountCode === cogsCode);
    const payrollRow = rows.find((r) => r.accountCode === payrollExpenseCode);
    const fxRow = rows.find((r) => r.accountCode === fxGainCode);
    const trialBalanceProfitProxy = (revenueRow
      ? new Decimal(revenueRow.periodCredit).sub(new Decimal(revenueRow.periodDebit))
      : new Decimal(0))
      .sub(
        cogsRow
          ? new Decimal(cogsRow.periodDebit).sub(new Decimal(cogsRow.periodCredit))
          : new Decimal(0),
      )
      .sub(
        payrollRow
          ? new Decimal(payrollRow.periodDebit).sub(new Decimal(payrollRow.periodCredit))
          : new Decimal(0),
      )
      .sub(
        fxRow
          ? new Decimal(fxRow.periodDebit).sub(new Decimal(fxRow.periodCredit))
          : new Decimal(0),
      );

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      accountingBookId: scope.accountingBookId,
      openingSnapshotDate: snapshotDate?.toISOString().slice(0, 10) ?? null,
      rows,
      totals: {
        periodDebit: totalPeriodDebit.toFixed(4),
        periodCredit: totalPeriodCredit.toFixed(4),
        balanced: isBalanced,
      },
      crossValidation: {
        netProfitProxy: trialBalanceProfitProxy.toFixed(4),
      },
      performance: {
        accountRows: rows.length,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }

  async compareBooks(
    organizationId: string,
    bookAId: string,
    bookBId: string,
    dateFromStr: string,
    dateToStr: string,
  ) {
    if (!bookAId?.trim() || !bookBId?.trim() || bookAId === bookBId) {
      throw new BadRequestException("Two different accounting books are required");
    }
    let dateFrom: Date;
    let dateTo: Date;
    try {
      dateFrom = parseIsoDateOnly(dateFromStr);
      dateTo = parseIsoDateOnly(dateToStr);
    } catch {
      throw new BadRequestException(
        "Invalid dateFrom/dateTo (expected YYYY-MM-DD)",
      );
    }
    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException("dateFrom must be <= dateTo");
    }

    const books = await this.prisma.accountingBook.findMany({
      where: {
        organizationId,
        id: { in: [bookAId, bookBId] },
        status: "ACTIVE",
      },
    });
    if (books.length !== 2) {
      throw new BadRequestException("Both accounting books must be active");
    }

    const build = async (bookId: string) => {
      const book = books.find((row) => row.id === bookId)!;
      const accounts = await this.prisma.account.findMany({
        where: { organizationId, accountingBookId: bookId },
        orderBy: { code: "asc" },
      });
      const accountIds = accounts.map((account) => account.id);
      const [opening, period] =
        accountIds.length === 0
          ? [[], []]
          : await Promise.all([
              this.prisma.journalEntry.groupBy({
                by: ["accountId"],
                where: {
                  organizationId,
                  accountingBookId: bookId,
                  accountId: { in: accountIds },
                  transaction: { date: { lt: dateFrom }, isFinal: true },
                },
                _sum: { debit: true, credit: true },
              }),
              this.prisma.journalEntry.groupBy({
                by: ["accountId"],
                where: {
                  organizationId,
                  accountingBookId: bookId,
                  accountId: { in: accountIds },
                  transaction: {
                    date: { gte: dateFrom, lte: dateTo },
                    isFinal: true,
                  },
                },
                _sum: { debit: true, credit: true },
              }),
            ]);
      const openingByAccount = new Map(
        opening.map((row) => [
          row.accountId,
          { debit: d(row._sum.debit), credit: d(row._sum.credit) },
        ]),
      );
      const periodByAccount = new Map(
        period.map((row) => [
          row.accountId,
          { debit: d(row._sum.debit), credit: d(row._sum.credit) },
        ]),
      );
      const rows = accounts.map((account) => {
        const openingValue = openingByAccount.get(account.id) ?? {
          debit: new Decimal(0),
          credit: new Decimal(0),
        };
        const periodValue = periodByAccount.get(account.id) ?? {
          debit: new Decimal(0),
          credit: new Decimal(0),
        };
        const openingSplit = splitDrCr(
          openingValue.debit.sub(openingValue.credit),
        );
        const closingSplit = splitDrCr(
          openingValue.debit
            .sub(openingValue.credit)
            .add(periodValue.debit)
            .sub(periodValue.credit),
        );
        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: pickAccountDisplayName(account, "ru"),
          accountType: account.type,
          openingDebit: openingSplit.debit.toFixed(4),
          openingCredit: openingSplit.credit.toFixed(4),
          periodDebit: periodValue.debit.toFixed(4),
          periodCredit: periodValue.credit.toFixed(4),
          closingDebit: closingSplit.debit.toFixed(4),
          closingCredit: closingSplit.credit.toFixed(4),
        };
      });
      return {
        book,
        rows,
        totals: {
          periodDebit: rows
            .reduce(
              (sum, row) => sum.add(row.periodDebit),
              new Decimal(0),
            )
            .toFixed(4),
          periodCredit: rows
            .reduce(
              (sum, row) => sum.add(row.periodCredit),
              new Decimal(0),
            )
            .toFixed(4),
        },
      };
    };

    const [bookA, bookB] = await Promise.all([build(bookAId), build(bookBId)]);
    return { dateFrom: dateFromStr, dateTo: dateToStr, bookA, bookB };
  }

  /**
   * P&L по проводкам (начисление): 601 − 701 − 721 − 662 (см. ТЗ).
   * 662 — прочие доходы (курсовая прибыль): при преобладании кредита уменьшает «расходную» часть формулы.
   */
  async profitAndLoss(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    ledgerType: LedgerType = LedgerType.NAS,
    departmentId?: string | null,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    ledgerType = scope.ledgerType;
    const startedAt = Date.now();
    if (!dateFromStr?.trim() || !dateToStr?.trim()) {
      throw new BadRequestException("dateFrom and dateTo are required");
    }
    let dateFrom: Date;
    let dateTo: Date;
    try {
      dateFrom = parseIsoDateOnly(dateFromStr);
      dateTo = parseIsoDateOnly(dateToStr);
    } catch {
      throw new BadRequestException(
        "Invalid dateFrom/dateTo (expected YYYY-MM-DD)",
      );
    }
    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException("dateFrom must be <= dateTo");
    }

    const [revenueCode, cogsCode, payrollExpenseCode, fxGainCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "SALES_REVENUE"),
      this.posting.resolveAccountCode(organizationId, "COGS"),
      this.posting.resolveAccountCode(organizationId, "PAYROLL_EXPENSE"),
      this.posting.resolveAccountCode(organizationId, "FX_GAIN"),
    ]);

    const codes = [
      revenueCode,
      cogsCode,
      payrollExpenseCode,
      fxGainCode,
    ] as const;
    const accs = await this.prisma.account.findMany({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: { in: [...codes] },
      },
    });
    const byCode = new Map(accs.map((a) => [a.code, a]));
    const ids = accs.map((a) => a.id);

    if (ids.length === 0) {
      return {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        ledgerType,
        departmentId: departmentId?.trim() ?? null,
        payrollExpenseSource: "ledger" as const,
        lines: [],
        netProfit: "0.0000",
        methodologyNote:
          "Начисление по счетам ГК; не совпадает с кассовым «оплаты − COGS − налоги ЗП» без доп. сверки.",
      };
    }

    const deptFilter = departmentId?.trim();
    if (deptFilter) {
      const dept = await this.prisma.department.findFirst({
        where: { id: deptFilter, organizationId },
      });
      if (!dept) {
        throw new BadRequestException("Неизвестный департамент");
      }
    }

    const transactionWhere: Prisma.TransactionWhereInput = {
      date: { gte: dateFrom, lte: dateTo },
      ...(deptFilter ? { departmentId: deptFilter } : {}),
    };

    const agg = await this.prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        accountId: { in: ids },
        transaction: { ...transactionWhere, isFinal: true },
      },
      _sum: { debit: true, credit: true },
    });
    const sumMap = new Map(
      agg.map((r) => [
        r.accountId,
        { dr: d(r._sum.debit), cr: d(r._sum.credit) },
      ]),
    );

    const pick = (code: string) => {
      const a = byCode.get(code);
      if (!a) {
        return { dr: new Decimal(0), cr: new Decimal(0) };
      }
      return sumMap.get(a.id) ?? { dr: new Decimal(0), cr: new Decimal(0) };
    };

    const r601 = pick(revenueCode);
    const revenueNet = r601.cr.sub(r601.dr);

    const r701 = pick(cogsCode);
    const cogsNet = r701.dr.sub(r701.cr);

    const r721 = pick(payrollExpenseCode);
    const payrollExpenseNet = r721.dr.sub(r721.cr);

    const r662 = pick(fxGainCode);
    const fx662Net = r662.dr.sub(r662.cr);

    const netProfit = revenueNet
      .sub(cogsNet)
      .sub(payrollExpenseNet)
      .sub(fx662Net);

    const trialBalanceView =
      deptFilter == null
        ? await this.trialBalance(
            organizationId,
            dateFromStr,
            dateToStr,
            ledgerType,
            scope.accountingBookId,
          )
        : null;
    const tbProxy =
      trialBalanceView != null
        ? new Decimal(trialBalanceView.crossValidation?.netProfitProxy ?? "0")
        : netProfit;
    const crossValidationDelta = absDelta(netProfit, tbProxy);
    const crossValidationOk =
      trialBalanceView == null
        ? true
        : crossValidationDelta.lte(new Decimal("0.0100"));

    const payrollLabel =
      deptFilter != null
        ? `Расходы на ЗП по департаменту (${payrollExpenseCode})`
        : `Расходы на ЗП (${payrollExpenseCode})`;

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      departmentId: deptFilter ?? null,
      payrollExpenseSource: "ledger",
      lines: [
        {
          accountCode: revenueCode,
          label: `Выручка (${revenueCode})`,
          amount: revenueNet.toFixed(4),
        },
        {
          accountCode: cogsCode,
          label: `Себестоимость (${cogsCode})`,
          amount: cogsNet.neg().toFixed(4),
        },
        {
          accountCode: payrollExpenseCode,
          label: payrollLabel,
          amount: payrollExpenseNet.neg().toFixed(4),
        },
        {
          accountCode: fxGainCode,
          label: `Прочие доходы/расходы (${fxGainCode}, по Дт−Кт)`,
          amount: fx662Net.neg().toFixed(4),
        },
      ],
      detail: {
        revenueCreditMinusDebit: revenueNet.toFixed(4),
        cogsDebitMinusCredit: cogsNet.toFixed(4),
        payrollDebitMinusCredit: payrollExpenseNet.toFixed(4),
        fx662DebitMinusCredit: fx662Net.toFixed(4),
      },
      netProfit: netProfit.toFixed(4),
      crossValidation: {
        trialBalanceNetProfitProxy: tbProxy.toFixed(4),
        delta: crossValidationDelta.toFixed(4),
        ok: crossValidationOk,
        scope: trialBalanceView == null ? "department-filtered" : "full-ledger",
      },
      performance: {
        elapsedMs: Date.now() - startedAt,
        rowsProcessed: agg.length,
      },
      methodologyNote:
        "Чистая прибыль по начислению (обороты по счетам за период). Кассовая сверка «сумма оплат − себестоимость − налоги с ЗП» даст другой результат, если оплаты и начисления не совпадают по периодам." +
        (deptFilter
          ? " При фильтре ЦФО обороты по выручке, себестоимости, ФОТ и 662 учитываются только по транзакциям с привязкой к этому департаменту."
          : ""),
    };
  }

  /**
   * Full income statement: all REVENUE / EXPENSE accounts (6x / 7x class),
   * used as accounting result for profit-tax aggregation.
   */
  async fullIncomeStatement(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(organizationId, ledgerType, accountingBookId);
    ledgerType = scope.ledgerType;
    if (!dateFromStr?.trim() || !dateToStr?.trim()) {
      throw new BadRequestException("dateFrom and dateTo are required");
    }
    let dateFrom: Date;
    let dateTo: Date;
    try {
      dateFrom = parseIsoDateOnly(dateFromStr);
      dateTo = parseIsoDateOnly(dateToStr);
    } catch {
      throw new BadRequestException(
        "Invalid dateFrom/dateTo (expected YYYY-MM-DD)",
      );
    }
    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException("dateFrom must be <= dateTo");
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
      },
      orderBy: { code: "asc" },
    });

    const empty = {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      revenue: [] as Array<{
        accountCode: string;
        accountName: string;
        section: string;
        amount: string;
      }>,
      expenses: [] as Array<{
        accountCode: string;
        accountName: string;
        section: string;
        amount: string;
      }>,
      totals: { revenue: "0.0000", expenses: "0.0000" },
      accountingResult: "0.0000",
    };

    if (accounts.length === 0) {
      return empty;
    }

    const agg = await this.prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        accountId: { in: accounts.map((a) => a.id) },
        transaction: {
          date: { gte: dateFrom, lte: dateTo },
          isFinal: true,
        },
      },
      _sum: { debit: true, credit: true },
    });
    const sumMap = new Map(
      agg.map((r) => [
        r.accountId,
        { dr: d(r._sum.debit), cr: d(r._sum.credit) },
      ]),
    );

    const revenue: typeof empty.revenue = [];
    const expenses: typeof empty.expenses = [];
    let revTotal = new Decimal(0);
    let expTotal = new Decimal(0);

    for (const a of accounts) {
      const s = sumMap.get(a.id) ?? { dr: new Decimal(0), cr: new Decimal(0) };
      const section = a.code.length >= 1 ? `${a.code.charAt(0)}x` : "?";
      const name = pickAccountDisplayName(a, "en");
      if (a.type === AccountType.REVENUE) {
        const amount = s.cr.sub(s.dr);
        if (amount.isZero()) continue;
        revTotal = revTotal.add(amount);
        revenue.push({
          accountCode: a.code,
          accountName: name,
          section,
          amount: amount.toFixed(4),
        });
      } else {
        const amount = s.dr.sub(s.cr);
        if (amount.isZero()) continue;
        expTotal = expTotal.add(amount);
        expenses.push({
          accountCode: a.code,
          accountName: name,
          section,
          amount: amount.toFixed(4),
        });
      }
    }

    const accountingResult = revTotal.sub(expTotal);
    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      revenue,
      expenses,
      totals: {
        revenue: revTotal.toFixed(4),
        expenses: expTotal.toFixed(4),
      },
      accountingResult: accountingResult.toFixed(4),
    };
  }

  /**
   * Дебиторская задолженность по контрагентам: неоплаченная часть счетов,
   * по которым уже отражена выручка (Дт 211 — Кт 601), оплата ещё не проведена.
   */
  async accountsReceivable(
    organizationId: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    ledgerType = scope.ledgerType;
    const receivableCode = await this.posting.resolveAccountCode(
      organizationId,
      "TRADE_RECEIVABLE",
    );
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        revenueRecognized: true,
        status: { not: InvoiceStatus.CANCELLED },
      },
    });

    const arAcc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: receivableCode,
      },
    });
    const displayAccountCode = arAcc?.code ?? receivableCode;

    const byCp = new Map<string, Decimal>();
    for (const inv of invoices) {
      const bal = inv.totalAmount.sub(inv.paidAmount ?? new Decimal(0));
      if (bal.lte(0)) continue;
      const prev = byCp.get(inv.counterpartyId) ?? new Decimal(0);
      byCp.set(inv.counterpartyId, prev.add(bal));
    }

    if (byCp.size === 0) {
      return {
        ledgerType,
        accountCode: displayAccountCode,
        rows: [] as {
          counterpartyId: string;
          name: string;
          taxId: string;
          balance: string;
        }[],
        totalBalance: "0.0000",
      };
    }

    const ids = [...byCp.keys()];
    const counterparties = await this.prisma.counterparty.findMany({
      where: { organizationId, id: { in: ids } },
    });
    const byId = new Map(counterparties.map((c) => [c.id, c]));

    let total = new Decimal(0);
    const rows = [...byCp.entries()]
      .map(([counterpartyId, bal]) => {
        const cp = byId.get(counterpartyId);
        total = total.add(bal);
        return {
          counterpartyId,
          name: cp?.nameCipher ? decryptText(cp.nameCipher) ?? "—" : "—",
          taxId: cp?.taxIdCipher ? decryptText(cp.taxIdCipher) ?? "—" : "—",
          balance: bal.toFixed(4),
        };
      })
      .sort((a, b) => Number(b.balance) - Number(a.balance));

    return {
      ledgerType,
      accountCode: displayAccountCode,
      rows,
      totalBalance: total.toFixed(4),
    };
  }

  /**
   * Акт сверки взаиморасчётов с контрагентом (дебиторка по выставленным счетам и оплатам).
   * Поле `transactions` — хронология с разворотом по строкам `JournalEntry` (NAS), где удалось сопоставить проводки.
   * Обороты 531 по контрагенту в модели не разнесены — только счета-фактуры и платежи.
   */
  async counterpartyReconciliation(
    organizationId: string,
    counterpartyId: string,
    dateFromStr: string,
    dateToStr: string,
    options?: CounterpartyReconciliationOptions,
  ) {
    if (!dateFromStr?.trim() || !dateToStr?.trim()) {
      throw new BadRequestException(
        "dateFrom/dateTo or startDate/endDate are required (YYYY-MM-DD)",
      );
    }
    let dateFrom: Date;
    let dateTo: Date;
    try {
      dateFrom = parseIsoDateOnly(dateFromStr);
      dateTo = parseIsoDateOnly(dateToStr);
    } catch {
      throw new BadRequestException("Invalid dates (expected YYYY-MM-DD)");
    }
    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException("dateFrom must be <= dateTo");
    }
    const scope = await this.resolveBookScope(
      organizationId,
      options?.ledgerType ?? LedgerType.NAS,
      options?.accountingBookId,
    );
    options = {
      ...options,
      ledgerType: scope.ledgerType,
      accountingBookId: scope.accountingBookId,
    };

    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId },
      select: { id: true, nameCipher: true, taxIdCipher: true },
    });
    if (!cp) {
      throw new BadRequestException("Counterparty not found");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, taxIdCipher: true },
    });

    const built = await buildCounterpartyReconciliationPayload(
      this.prisma,
      organizationId,
      counterpartyId,
      dateFrom,
      dateTo,
      dateFromStr,
      dateToStr,
      {
        receivable: await this.posting.resolveAccountCode(organizationId, "TRADE_RECEIVABLE"),
        revenue: await this.posting.resolveAccountCode(organizationId, "SALES_REVENUE"),
      },
      options,
    );

    const opening = built.opening;
    const closing = built.closing;
    const primaryCurrency = built.primaryCurrency;

    return {
      organizationName: org?.name ?? "",
      organizationTaxId: decodeOrganizationTaxId(org),
      counterpartyId: cp.id,
      counterpartyName: cp.nameCipher ? decryptText(cp.nameCipher) ?? "" : "",
      counterpartyTaxId: cp.taxIdCipher ? decryptText(cp.taxIdCipher) ?? "" : "",
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      startDate: dateFromStr,
      endDate: dateToStr,
      currency: options?.currency?.trim().toUpperCase() ?? null,
      ledgerType: options?.ledgerType ?? LedgerType.NAS,
      openingBalance: opening.toFixed(4),
      closingBalance: closing.toFixed(4),
      openingBalanceDetail: {
        signedAmount: opening.toFixed(4),
        amount: opening.abs().toFixed(4),
        currency: primaryCurrency,
        side: opening.gte(0) ? ("DR" as const) : ("CR" as const),
      },
      closingBalanceDetail: {
        signedAmount: closing.toFixed(4),
        amount: closing.abs().toFixed(4),
        currency: primaryCurrency,
        side: closing.gte(0) ? ("DR" as const) : ("CR" as const),
      },
      turnoverDebit: built.turnoverDebit.toFixed(4),
      turnoverCredit: built.turnoverCredit.toFixed(4),
      lines: built.lines,
      transactions: built.transactions,
      methodologyNote:
        "Сальдо: непогашенная дебиторская задолженность по счетам с признанной выручкой. Кредиторка (531) по поставщику в учёте не привязана к контрагенту — в акт не включена.",
      methodologyNoteAz:
        "Qeyd: Qalıq debitor borcunu əks etdirir (211, hesablanmış gəlir). Təchizatçı üzrə 531 kreditor borcu bu modeldə kontagentə birbaşa bağlı deyil və akta daxil edilmir.",
    };
  }

  async counterpartyReconciliationXlsx(
    organizationId: string,
    counterpartyId: string,
    dateFromStr: string,
    dateToStr: string,
    options?: CounterpartyReconciliationOptions,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.counterpartyReconciliation(
      organizationId,
      counterpartyId,
      dateFromStr,
      dateToStr,
      options,
    );
    const currencyLabel = data.currency ?? data.openingBalanceDetail.currency ?? "AZN";
    return counterpartyReconciliationXlsxBuffer({
      organizationName: data.organizationName,
      organizationTaxId: data.organizationTaxId,
      counterpartyName: data.counterpartyName,
      counterpartyTaxId: data.counterpartyTaxId,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      currencyLabel,
      transactions: data.transactions,
    });
  }

  async counterpartyReconciliationPdf(
    organizationId: string,
    counterpartyId: string,
    dateFromStr: string,
    dateToStr: string,
    options?: CounterpartyReconciliationOptions,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.counterpartyReconciliation(
      organizationId,
      counterpartyId,
      dateFromStr,
      dateToStr,
      options,
    );

    const reconDocId = reconciliationDocumentUuid(
      organizationId,
      counterpartyId,
      data.dateFrom,
      data.dateTo,
    );
    const sigLog = await this.prisma.digitalSignatureLog.findFirst({
      where: {
        organizationId,
        documentId: reconDocId,
        documentKind: SignedDocumentKind.RECONCILIATION_ACT,
        status: DigitalSignatureStatus.COMPLETED,
      },
      orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
    });
    const verifyBase = verifyQrPublicBase(this.config);
    const signatureVerifyUrl = sigLog
      ? `${verifyBase}/verify/${sigLog.id}`
      : undefined;

    const buffer = await renderReconciliationPdfAz({
      organizationName: data.organizationName,
      organizationTaxId: data.organizationTaxId,
      counterpartyName: data.counterpartyName,
      counterpartyTaxId: data.counterpartyTaxId,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      openingBalance: data.openingBalance,
      turnoverDebit: data.turnoverDebit,
      turnoverCredit: data.turnoverCredit,
      closingBalance: data.closingBalance,
      methodologyNoteAz: data.methodologyNoteAz,
      signatureVerifyUrl,
      lines: data.lines.map((l) => ({
        kind: l.kind,
        date: l.date,
        reference: l.reference,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
        balanceAfter: l.balanceAfter,
      })),
    });

    if (sigLog) {
      const hashHex = createHash("sha256").update(buffer).digest("hex");
      await this.prisma.digitalSignatureLog.update({
        where: { id: sigLog.id },
        data: { contentHashSha256: hashHex },
      });
    }
    const safeCp = counterpartyId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12);
    const filename = `akt-heshlasma-${safeCp || "cp"}-${data.dateFrom}-${data.dateTo}.pdf`;
    return { buffer, filename };
  }

  /** AR Aging: 0-30 / 31-60 / 61-90 / 90+ дней. */
  async accountsReceivableAging(
    organizationId: string,
    asOfIso?: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(organizationId, ledgerType, accountingBookId);
    ledgerType = scope.ledgerType;
    const today = asOfIso?.trim() ? parseIsoDateOnly(asOfIso) : new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );

    const recognizedTransactions = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        isFinal: true,
        reference: { not: null },
        journalEntries: {
          some: {
            organizationId,
            ledgerType,
            accountingBookId: scope.accountingBookId,
          },
        },
      },
      select: { reference: true },
    });
    const eligibleInvoiceNumbers = recognizedTransactions
      .map((row) => row.reference)
      .filter((value): value is string => Boolean(value));
    const invoices = eligibleInvoiceNumbers.length
      ? await this.prisma.invoice.findMany({
      where: {
        organizationId,
        number: { in: eligibleInvoiceNumbers },
        revenueRecognized: true,
        status: { not: InvoiceStatus.CANCELLED },
        counterparty: {
          role: { in: [CounterpartyRole.CUSTOMER, CounterpartyRole.BOTH] },
        },
      },
      include: {
        counterparty: { select: { id: true, nameCipher: true, taxIdCipher: true } },
      },
      })
      : [];

    type Bucket = {
      b0_30: Decimal;
      b31_60: Decimal;
      b61_90: Decimal;
      b90_plus: Decimal;
    };
    const byCp = new Map<
      string,
      { name: string; taxId: string; buckets: Bucket }
    >();

    for (const inv of invoices) {
      const outstanding = inv.totalAmount.sub(inv.paidAmount ?? new Decimal(0));
      if (outstanding.lte(0)) continue;

      const due = inv.dueDate;
      const dueUtc = Date.UTC(
        due.getUTCFullYear(),
        due.getUTCMonth(),
        due.getUTCDate(),
      );
      const daysPastDue = Math.max(0, Math.floor((todayUtc - dueUtc) / 86400000));

      let bucket: keyof Bucket;
      if (daysPastDue <= 30) bucket = "b0_30";
      else if (daysPastDue <= 60) bucket = "b31_60";
      else if (daysPastDue <= 90) bucket = "b61_90";
      else bucket = "b90_plus";

      const id = inv.counterpartyId;
      const cur =
        byCp.get(id) ??
        {
          name: inv.counterparty.nameCipher
            ? decryptText(inv.counterparty.nameCipher) ?? ""
            : "",
          taxId: inv.counterparty.taxIdCipher
            ? decryptText(inv.counterparty.taxIdCipher) ?? ""
            : "",
          buckets: {
            b0_30: new Decimal(0),
            b31_60: new Decimal(0),
            b61_90: new Decimal(0),
            b90_plus: new Decimal(0),
          },
        };
      cur.buckets[bucket] = cur.buckets[bucket].add(outstanding);
      byCp.set(id, cur);
    }

    const rows = [...byCp.entries()].map(([counterpartyId, v]) => ({
      counterpartyId,
      name: v.name,
      taxId: v.taxId,
      bucket0to30: v.buckets.b0_30.toFixed(4),
      bucket31to60: v.buckets.b31_60.toFixed(4),
      bucket61to90: v.buckets.b61_90.toFixed(4),
      bucket90plus: v.buckets.b90_plus.toFixed(4),
      total: v.buckets.b0_30
        .add(v.buckets.b31_60)
        .add(v.buckets.b61_90)
        .add(v.buckets.b90_plus)
        .toFixed(4),
    }));

    rows.sort((a, b) => Number(b.total) - Number(a.total));

    const sum = rows.reduce(
      (acc, r) => ({
        bucket0to30: acc.bucket0to30.add(new Decimal(r.bucket0to30)),
        bucket31to60: acc.bucket31to60.add(new Decimal(r.bucket31to60)),
        bucket61to90: acc.bucket61to90.add(new Decimal(r.bucket61to90)),
        bucket90plus: acc.bucket90plus.add(new Decimal(r.bucket90plus)),
        total: acc.total.add(new Decimal(r.total)),
      }),
      {
        bucket0to30: new Decimal(0),
        bucket31to60: new Decimal(0),
        bucket61to90: new Decimal(0),
        bucket90plus: new Decimal(0),
        total: new Decimal(0),
      },
    );

    return {
      asOf: new Date(todayUtc).toISOString().slice(0, 10),
      ledgerType,
      accountingBookId: scope.accountingBookId,
      rows,
      totals: {
        bucket0to30: sum.bucket0to30.toFixed(4),
        bucket31to60: sum.bucket31to60.toFixed(4),
        bucket61to90: sum.bucket61to90.toFixed(4),
        bucket90plus: sum.bucket90plus.toFixed(4),
        total: sum.total.toFixed(4),
      },
      methodologyNote:
        "Корзины просрочки по dueDate на дату asOf: 0-30, 31-60, 61-90 и 90+ дней.",
    };
  }

  async dashboard(
    organizationId: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    ledgerType = scope.ledgerType;
    const [
      payrollTaxPayableCode,
      supplierPayableCode,
      revenueCode,
      payrollExpenseCode,
    ] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "PAYROLL_TAX_PAYABLE"),
      this.posting.resolveAccountCode(organizationId, "SUPPLIER_PAYABLE"),
      this.posting.resolveAccountCode(organizationId, "SALES_REVENUE"),
      this.posting.resolveAccountCode(organizationId, "PAYROLL_EXPENSE"),
    ]);
    const today = new Date();
    const from30 = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 29,
        0,
        0,
        0,
        0,
      ),
    );
    const toDay = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const cashAccs = await this.prisma.account.findMany({
      where: await this.cashBankAccountWhere(
        organizationId,
        ledgerType,
        scope.accountingBookId,
      ),
    });
    const taxAcc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: payrollTaxPayableCode,
      },
    });
    const pay531Acc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: supplierPayableCode,
      },
    });
    const revAcc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: revenueCode,
      },
    });

    const cashIds = cashAccs.map((a) => a.id);

    const [cashAgg, taxAgg, pay531Agg] = await Promise.all([
      cashIds.length
        ? this.prisma.journalEntry.aggregate({
            where: {
              organizationId,
              ledgerType,
              accountingBookId: scope.accountingBookId,
              accountId: { in: cashIds },
              transaction: { isFinal: true },
            },
            _sum: { debit: true, credit: true },
          })
        : Promise.resolve({ _sum: { debit: null, credit: null } }),
      taxAcc
        ? this.prisma.journalEntry.aggregate({
            where: {
              organizationId,
              ledgerType,
              accountingBookId: scope.accountingBookId,
              accountId: taxAcc.id,
              transaction: { isFinal: true },
            },
            _sum: { debit: true, credit: true },
          })
        : Promise.resolve({ _sum: { debit: null, credit: null } }),
      pay531Acc
        ? this.prisma.journalEntry.aggregate({
            where: {
              organizationId,
              ledgerType,
              accountingBookId: scope.accountingBookId,
              accountId: pay531Acc.id,
              transaction: { isFinal: true },
            },
            _sum: { debit: true, credit: true },
          })
        : Promise.resolve({ _sum: { debit: null, credit: null } }),
    ]);

    const cashNet = netDrMinusCr(
      d(cashAgg._sum.debit),
      d(cashAgg._sum.credit),
    );
    const taxNet = netDrMinusCr(d(taxAgg._sum.debit), d(taxAgg._sum.credit));
    const taxPayableBalance = taxNet.neg();
    const pay531Net = netDrMinusCr(
      d(pay531Agg._sum.debit),
      d(pay531Agg._sum.credit),
    );
    const pay531Liability = pay531Net.neg();
    const obligations521531Balance = taxPayableBalance.add(pay531Liability);

    const exp721Acc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: payrollExpenseCode,
      },
    });
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() + 1;
    const { start: monthStart, end: monthEnd } = monthRangeUtc(y, m);
    let currentMonthExpense721 = "0.0000";
    if (exp721Acc) {
      const j721 = await this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          ledgerType,
          accountingBookId: scope.accountingBookId,
          accountId: exp721Acc.id,
          transaction: { date: { gte: monthStart, lte: monthEnd }, isFinal: true },
        },
        select: { debit: true, credit: true },
      });
      let expNet = new Decimal(0);
      for (const row of j721) {
        expNet = expNet.add(d(row.debit).sub(d(row.credit)));
      }
      currentMonthExpense721 = expNet.toFixed(4);
    }

    const topProducts = await this.prisma.invoiceItem.groupBy({
      by: ["productId"],
      where: {
        organizationId,
        productId: { not: null },
        invoice: {
          status: {
            in: [
              InvoiceStatus.PAID,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.LOCKED_BY_SIGNATURE,
            ],
          },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const prodIds = topProducts
      .map((t) => t.productId)
      .filter((x): x is string => x != null);
    const products = await this.prisma.product.findMany({
      where: { id: { in: prodIds }, organizationId },
    });
    const pById = new Map(products.map((p) => [p.id, p]));

    const topProductsOut = topProducts.map((t) => {
      const p = t.productId ? pById.get(t.productId) : undefined;
      return {
        productId: t.productId,
        name: p?.name ?? "—",
        sku: p?.sku ?? "—",
        quantity: d(t._sum.quantity).toFixed(4),
      };
    });

    let revenueByDay: { date: string; amount: string }[] = [];
    if (revAcc) {
      const revRows = await this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          ledgerType,
          accountingBookId: scope.accountingBookId,
          accountId: revAcc.id,
          transaction: {
            date: { gte: from30, lte: toDay },
            isFinal: true,
          },
        },
        select: {
          debit: true,
          credit: true,
          transaction: { select: { date: true } },
        },
      });
      const byDay = new Map<string, Decimal>();
      for (const row of revRows) {
        const day = row.transaction.date.toISOString().slice(0, 10);
        const prev = byDay.get(day) ?? new Decimal(0);
        byDay.set(
          day,
          prev.add(d(row.credit).sub(d(row.debit))),
        );
      }
      revenueByDay = [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, net]) => ({ date, amount: net.toFixed(4) }));
    }

    const arData = await this.accountsReceivable(
      organizationId,
      ledgerType,
      scope.accountingBookId,
    );
    const topDebtors = arData.rows.slice(0, 5).map((r) => ({
      counterpartyId: r.counterpartyId,
      name: r.name,
      balance: r.balance,
    }));

    const creditorBalances = new Map<string, Decimal>();
    if (pay531Acc) {
      const entries = await this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          ledgerType,
          accountingBookId: scope.accountingBookId,
          accountId: pay531Acc.id,
          transaction: { counterpartyId: { not: null }, isFinal: true },
        },
        include: {
          transaction: { select: { counterpartyId: true } },
        },
      });
      for (const e of entries) {
        const cid = e.transaction.counterpartyId;
        if (!cid) continue;
        const net = d(e.credit).sub(d(e.debit));
        creditorBalances.set(
          cid,
          (creditorBalances.get(cid) ?? new Decimal(0)).add(net),
        );
      }
    }
    const creditorSorted = [...creditorBalances.entries()]
      .filter(([, bal]) => bal.gt(0))
      .sort((a, b) => b[1].sub(a[1]).toNumber())
      .slice(0, 5);
    const creditorIds = creditorSorted.map(([id]) => id);
    const creditorCps =
      creditorIds.length > 0
        ? await this.prisma.counterparty.findMany({
            where: { organizationId, id: { in: creditorIds } },
          })
        : [];
    const byCredId = new Map(creditorCps.map((c) => [c.id, c]));
    const topCreditors = creditorSorted.map(([id, bal]) => {
      const c = byCredId.get(id);
      return {
        counterpartyId: id,
        name: c?.nameCipher ? decryptText(c.nameCipher) ?? "—" : "—",
        balance: bal.toFixed(4),
      };
    });

    return {
      ledgerType,
      cashBankBalance: cashNet.toFixed(4),
      obligations521531Balance: obligations521531Balance.toFixed(4),
      currentMonthExpense721,
      topProducts: topProductsOut,
      revenueByDay,
      topDebtors,
      topCreditors,
    };
  }

  /** Текущий календарный месяц (UTC): закрыт ли месяц для указанной книги. */
  async getPeriodStatus(
    organizationId: string,
    ledgerType: "NAS" | "IFRS" | "MANAGEMENT" = "NAS",
    accountingBookId?: string,
  ) {
    const book = await this.accountingBooks.resolveByIdOrLedgerAlias(
      organizationId,
      accountingBookId,
      ledgerType,
    );
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(
      org?.settings,
      book.gaapKind,
      book.id,
    );
    return {
      year,
      month,
      periodKey: key,
      ledgerType: book.gaapKind,
      accountingBookId: book.id,
      isClosed: closed.includes(key),
    };
  }

  /**
   * Самый ранний прошедший UTC-месяц, ещё не закрытый для указанной книги.
   */
  async getClosePeriodPrompt(
    organizationId: string,
    ledgerType: "NAS" | "IFRS" | "MANAGEMENT" = "NAS",
    accountingBookId?: string,
  ) {
    const book = await this.accountingBooks.resolveByIdOrLedgerAlias(
      organizationId,
      accountingBookId,
      ledgerType,
    );
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(org?.settings, book.gaapKind, book.id);
    const now = new Date();
    const curY = now.getUTCFullYear();
    const curM = now.getUTCMonth() + 1;
    const curKey = `${curY}-${String(curM).padStart(2, "0")}`;
    for (let offset = 1; offset <= 36; offset += 1) {
      const d = new Date(Date.UTC(curY, curM - 1 - offset, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (key >= curKey) continue;
      if (!closed.includes(key)) {
        return {
          show: true as const,
          year: y,
          month: m,
          periodKey: key,
          ledgerType: book.gaapKind,
          accountingBookId: book.id,
        };
      }
    }
    return {
      show: false as const,
      year: null,
      month: null,
      periodKey: null,
      ledgerType: book.gaapKind,
      accountingBookId: book.id,
    };
  }

  /**
   * Краткие показатели для главной: P&L (чистая прибыль за текущий UTC-месяц),
   * упрощённый баланс (сальдо по типам на дату), движение денег на 101+221 за месяц.
   */
  async dashboardMiniFinancials(
    organizationId: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    ledgerType = scope.ledgerType;
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dateFromStr = `${y}-${pad(m)}-01`;
    const dateToStr = `${y}-${pad(m)}-${pad(lastDay)}`;

    const pl = await this.profitAndLoss(
      organizationId,
      dateFromStr,
      dateToStr,
      ledgerType,
      undefined,
      scope.accountingBookId,
    );

    const tb = await this.trialBalance(
      organizationId,
      "1970-01-01",
      dateToStr,
      ledgerType,
      scope.accountingBookId,
    );

    let assets = new Decimal(0);
    let liab = new Decimal(0);
    let eq = new Decimal(0);
    for (const row of tb.rows) {
      const net = new Decimal(row.closingDebit).sub(new Decimal(row.closingCredit));
      if (row.accountType === AccountType.ASSET) {
        assets = assets.add(net);
      } else if (row.accountType === AccountType.LIABILITY) {
        liab = liab.add(net.neg());
      } else if (row.accountType === AccountType.EQUITY) {
        eq = eq.add(net.neg());
      }
    }
    const totalLiabEq = liab.add(eq);

    const { start: monthStart, end: monthEnd } = monthRangeUtc(y, m);
    const cashAccs = await this.prisma.account.findMany({
      where: await this.cashBankAccountWhere(
        organizationId,
        ledgerType,
        scope.accountingBookId,
      ),
      select: { id: true },
    });
    const cashIds = cashAccs.map((a) => a.id);
    let cashFlowMonth = new Decimal(0);
    if (cashIds.length > 0) {
      const agg = await this.prisma.journalEntry.aggregate({
        where: {
          organizationId,
          ledgerType,
          accountingBookId: scope.accountingBookId,
          accountId: { in: cashIds },
          transaction: {
            date: { gte: monthStart, lte: endOfUtcDay(monthEnd) },
            isFinal: true,
          },
        },
        _sum: { debit: true, credit: true },
      });
      cashFlowMonth = d(agg._sum.debit).sub(d(agg._sum.credit));
    }

    return {
      ledgerType,
      periodLabel: `${y}-${pad(m)}`,
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      plNetProfit: pl.netProfit,
      totalAssets: assets.toFixed(4),
      totalLiabilitiesEquity: totalLiabEq.toFixed(4),
      cashFlowMonth: cashFlowMonth.toFixed(4),
    };
  }

  /**
   * Close fiscal year for one AccountingBook: require 12 closed months on that book,
   * roll P&L to PERIOD_RESULT (801), then to RETAINED_EARNINGS (802).
   * Records FiscalYearClose + settings.reporting.closedYearsByBookId (legacy NAS dual-write).
   */
  async closeFiscalYear(
    organizationId: string,
    year: number,
    closedByUserId?: string | null,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("year must be 2000-2100");
    }

    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    const bookLedger = scope.ledgerType;
    const bookId = scope.accountingBookId;
    const dualWriteLegacyNas = bookLedger === LedgerType.NAS;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new BadRequestException("Organization not found");

    if (getClosedYearKeys(org.settings, bookId).includes(year)) {
      throw new BadRequestException(
        `Fiscal year ${year} is already closed for this accounting book`,
      );
    }
    if (!areAllMonthsClosed(org.settings, year, bookLedger, bookId)) {
      throw new BadRequestException(
        `All 12 months of ${year} must be closed before fiscal year close`,
      );
    }

    const existing = await this.prisma.fiscalYearClose.findUnique({
      where: {
        organizationId_accountingBookId_year: {
          organizationId,
          accountingBookId: bookId,
          year,
        },
      },
    });
    if (existing && !existing.reversedAt) {
      throw new BadRequestException(
        `Fiscal year ${year} is already closed for this accounting book`,
      );
    }

    const { fromStr, toStr, end } = yearRangeUtc(year);
    const stmt = await this.fullIncomeStatement(
      organizationId,
      fromStr,
      toStr,
      bookLedger,
      bookId,
    );
    const result = new Decimal(stmt.accountingResult);

    const [periodResultCode, retainedCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "PERIOD_RESULT"),
      this.posting.resolveAccountCode(organizationId, "RETAINED_EARNINGS"),
    ]);

    const lines: Array<{
      accountCode: string;
      debit: string | number;
      credit: string | number;
    }> = [];

    for (const row of stmt.revenue) {
      const amt = new Decimal(row.amount);
      if (amt.lte(0)) continue;
      lines.push({
        accountCode: row.accountCode,
        debit: amt.toFixed(4),
        credit: 0,
      });
      lines.push({
        accountCode: periodResultCode,
        debit: 0,
        credit: amt.toFixed(4),
      });
    }
    for (const row of stmt.expenses) {
      const amt = new Decimal(row.amount);
      if (amt.lte(0)) continue;
      lines.push({
        accountCode: periodResultCode,
        debit: amt.toFixed(4),
        credit: 0,
      });
      lines.push({
        accountCode: row.accountCode,
        debit: 0,
        credit: amt.toFixed(4),
      });
    }

    // Transfer 801 → 802 (profit: Dr 801 Cr 802; loss: Dr 802 Cr 801)
    if (result.gt(0)) {
      lines.push({
        accountCode: periodResultCode,
        debit: result.toFixed(4),
        credit: 0,
      });
      lines.push({
        accountCode: retainedCode,
        debit: 0,
        credit: result.toFixed(4),
      });
    } else if (result.lt(0)) {
      const loss = result.neg();
      lines.push({
        accountCode: retainedCode,
        debit: loss.toFixed(4),
        credit: 0,
      });
      lines.push({
        accountCode: periodResultCode,
        debit: 0,
        credit: loss.toFixed(4),
      });
    }

    const closedAt = new Date();
    let transactionId: string | null = null;

    const protocolJson = {
      year,
      accountingBookId: bookId,
      ledgerType: bookLedger,
      closedAt: closedAt.toISOString(),
      revenue: stmt.revenue,
      expenses: stmt.expenses,
      accountingResult: result.toFixed(4),
      periodResultAccount: periodResultCode,
      retainedEarningsAccount: retainedCode,
      transactionId: null as string | null,
      lineCount: lines.length,
    };

    await this.prisma.$transaction(async (tx) => {
      if (lines.length > 0) {
        const posted = await this.accounting.postJournalInTransaction(tx, {
          organizationId,
          date: end,
          reference: `FY-CLOSE-${year}`,
          description: `Fiscal year ${year} close: P&L → ${periodResultCode} → ${retainedCode}`,
          isFinal: true,
          lines,
          ledgerType: bookLedger,
          accountingBookId: bookId,
          skipClosedPeriodGuard: true,
        });
        transactionId = posted.transactionId;
        protocolJson.transactionId = transactionId;
      }

      if (existing?.reversedAt) {
        await tx.fiscalYearClose.update({
          where: { id: existing.id },
          data: {
            closedAt,
            closedByUserId: closedByUserId ?? null,
            resultAmount: result,
            transactionId,
            protocolJson: protocolJson as Prisma.InputJsonValue,
            reversedAt: null,
            reversalTransactionId: null,
          },
        });
      } else {
        await tx.fiscalYearClose.create({
          data: {
            organizationId,
            accountingBookId: bookId,
            year,
            closedAt,
            closedByUserId: closedByUserId ?? null,
            resultAmount: result,
            transactionId,
            protocolJson: protocolJson as Prisma.InputJsonValue,
          },
        });
      }

      const fresh = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!fresh) throw new BadRequestException("Organization not found");
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          settings: mergeClosedYear(
            fresh.settings,
            year,
            bookId,
            dualWriteLegacyNas,
          ) as Prisma.InputJsonValue,
        },
      });
    });

    return {
      year,
      accountingBookId: bookId,
      ledgerType: bookLedger,
      closedAt: closedAt.toISOString(),
      accountingResult: result.toFixed(4),
      periodResultAccount: periodResultCode,
      retainedEarningsAccount: retainedCode,
      transactionId,
      protocolJson,
    };
  }

  /** Fiscal year close protocol row (reformation report). */
  async getFiscalYearClose(
    organizationId: string,
    year: number,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("year must be 2000-2100");
    }
    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    const row = await this.prisma.fiscalYearClose.findUnique({
      where: {
        organizationId_accountingBookId_year: {
          organizationId,
          accountingBookId: scope.accountingBookId,
          year,
        },
      },
    });
    if (!row || row.reversedAt) {
      throw new BadRequestException(
        `Fiscal year ${year} is not closed for this accounting book`,
      );
    }
    return row;
  }

  /**
   * Reopen a closed fiscal year: reverse the close journal, mark FiscalYearClose reversed,
   * remove year from settings.reporting.closedYearsByBookId (legacy NAS dual-write).
   */
  async reopenFiscalYear(
    organizationId: string,
    year: number,
    reopenedByUserId?: string | null,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("year must be 2000-2100");
    }

    const scope = await this.resolveBookScope(
      organizationId,
      ledgerType,
      accountingBookId,
    );
    const bookLedger = scope.ledgerType;
    const bookId = scope.accountingBookId;
    const dualWriteLegacyNas = bookLedger === LedgerType.NAS;

    const closeRow = await this.prisma.fiscalYearClose.findUnique({
      where: {
        organizationId_accountingBookId_year: {
          organizationId,
          accountingBookId: bookId,
          year,
        },
      },
    });
    if (!closeRow || closeRow.reversedAt) {
      throw new BadRequestException(
        `Fiscal year ${year} is not closed for this accounting book`,
      );
    }

    const { end } = yearRangeUtc(year);
    const reversedAt = new Date();
    let reversalTransactionId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const reverseLines: Array<{
        accountCode: string;
        debit: string;
        credit: string;
      }> = [];

      if (closeRow.transactionId) {
        const entries = await tx.journalEntry.findMany({
          where: {
            organizationId,
            transactionId: closeRow.transactionId,
            ledgerType: bookLedger,
            accountingBookId: bookId,
          },
          include: { account: { select: { code: true } } },
          orderBy: { createdAt: "asc" },
        });
        for (const e of entries) {
          reverseLines.push({
            accountCode: e.account.code,
            debit: e.credit.toFixed(4),
            credit: e.debit.toFixed(4),
          });
        }
      } else if (closeRow.protocolJson && typeof closeRow.protocolJson === "object") {
        const protocol = closeRow.protocolJson as Record<string, unknown>;
        const periodResultAccount = String(protocol.periodResultAccount ?? "");
        const retainedEarningsAccount = String(protocol.retainedEarningsAccount ?? "");
        const accountingResult = new Decimal(String(protocol.accountingResult ?? "0"));

        const revenue = Array.isArray(protocol.revenue) ? protocol.revenue : [];
        for (const row of revenue) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          const amt = new Decimal(String(r.amount ?? "0"));
          if (amt.lte(0)) continue;
          const code = String(r.accountCode ?? "");
          reverseLines.push({ accountCode: code, debit: "0", credit: amt.toFixed(4) });
          reverseLines.push({
            accountCode: periodResultAccount,
            debit: amt.toFixed(4),
            credit: "0",
          });
        }
        const expenses = Array.isArray(protocol.expenses) ? protocol.expenses : [];
        for (const row of expenses) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          const amt = new Decimal(String(r.amount ?? "0"));
          if (amt.lte(0)) continue;
          const code = String(r.accountCode ?? "");
          reverseLines.push({
            accountCode: periodResultAccount,
            debit: "0",
            credit: amt.toFixed(4),
          });
          reverseLines.push({ accountCode: code, debit: amt.toFixed(4), credit: "0" });
        }
        if (accountingResult.gt(0)) {
          reverseLines.push({
            accountCode: retainedEarningsAccount,
            debit: accountingResult.toFixed(4),
            credit: "0",
          });
          reverseLines.push({
            accountCode: periodResultAccount,
            debit: "0",
            credit: accountingResult.toFixed(4),
          });
        } else if (accountingResult.lt(0)) {
          const loss = accountingResult.neg();
          reverseLines.push({
            accountCode: periodResultAccount,
            debit: loss.toFixed(4),
            credit: "0",
          });
          reverseLines.push({
            accountCode: retainedEarningsAccount,
            debit: "0",
            credit: loss.toFixed(4),
          });
        }
      }

      if (reverseLines.length > 0) {
        const posted = await this.accounting.postJournalInTransaction(tx, {
          organizationId,
          date: end,
          reference: `FY-REOPEN-${year}`,
          description: `Fiscal year ${year} reopen (reversal of FY-CLOSE-${year})`,
          isFinal: true,
          lines: reverseLines,
          ledgerType: bookLedger,
          accountingBookId: bookId,
          skipClosedPeriodGuard: true,
        });
        reversalTransactionId = posted.transactionId;
      }

      await tx.fiscalYearClose.update({
        where: { id: closeRow.id },
        data: {
          reversedAt,
          reversalTransactionId,
        },
      });

      const fresh = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!fresh) throw new BadRequestException("Organization not found");
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          settings: unmergeClosedYear(
            fresh.settings,
            year,
            bookId,
            dualWriteLegacyNas,
          ) as Prisma.InputJsonValue,
        },
      });
    });

    return {
      year,
      accountingBookId: bookId,
      ledgerType: bookLedger,
      reversedAt: reversedAt.toISOString(),
      reversalTransactionId,
      reopenedByUserId: reopenedByUserId ?? null,
    };
  }

  async closePeriod(
    organizationId: string,
    year: number,
    month: number,
    ledgerType: "NAS" | "IFRS" | "MANAGEMENT" = "NAS",
    accountingBookId?: string,
  ) {
    if (month < 1 || month > 12) {
      throw new BadRequestException("month must be 1-12");
    }
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const { start, end } = monthRangeUtc(year, month);
    const book = await this.accountingBooks.resolveByIdOrLedgerAlias(
      organizationId,
      accountingBookId,
      ledgerType,
    );
    const ledgerEnum =
      book.gaapKind === "IFRS"
        ? LedgerType.IFRS
        : book.gaapKind === "MANAGEMENT"
          ? LedgerType.MANAGEMENT
          : LedgerType.NAS;

    const dep = await this.prisma.$transaction(async (tx) => {
      const depResult =
        ledgerType === "NAS"
          ? await this.depreciation.applyForClosedMonth(
              tx,
              organizationId,
              year,
              month,
            )
          : { applied: 0 };
      const iaResult =
        ledgerType === "NAS"
          ? await this.intangibleAmortization.applyForClosedMonth(
              tx,
              organizationId,
              year,
              month,
            )
          : { applied: 0 };

      // Lock policy (per-book):
      // - NAS close: lock all txs with NAS JE in the month (legacy).
      // - IFRS close: lock only IFRS-only txs (no NAS JE) so mirrored posts stay reversible on NAS.
      const txs = await tx.journalEntry.findMany({
        where: {
          organizationId,
          ledgerType: ledgerEnum,
          accountingBookId: book.id,
          transaction: {
            organizationId,
            date: { gte: start, lte: end },
          },
        },
        select: { transactionId: true },
        distinct: ["transactionId"],
      });
      let txIds = txs.map((t) => t.transactionId);
      if (ledgerEnum === LedgerType.IFRS && txIds.length > 0) {
        const withNas = await tx.journalEntry.findMany({
          where: {
            organizationId,
            ledgerType: "NAS",
            transactionId: { in: txIds },
          },
          select: { transactionId: true },
          distinct: ["transactionId"],
        });
        const nasSet = new Set(withNas.map((x) => x.transactionId));
        txIds = txIds.filter((id) => !nasSet.has(id));
      }
      if (txIds.length > 0) {
        await tx.transaction.updateMany({
          where: { id: { in: txIds }, organizationId },
          data: { isLocked: true },
        });
      }

      const snapshotDate = end;
      const grouped = await tx.journalEntry.groupBy({
        by: ["accountId", "ledgerType"],
        where: {
          organizationId,
          ledgerType: ledgerEnum,
          accountingBookId: book.id,
          transaction: { date: { lte: end }, isFinal: true },
        },
        _sum: { debit: true, credit: true },
      });
      for (const g of grouped) {
        await tx.accountBalance.upsert({
          where: {
            organizationId_accountId_ledgerType_balanceDate: {
              organizationId,
              accountId: g.accountId,
              ledgerType: g.ledgerType,
              balanceDate: snapshotDate,
            },
          },
          create: {
            organizationId,
            accountId: g.accountId,
            ledgerType: g.ledgerType,
            balanceDate: snapshotDate,
            debitBalance: d(g._sum.debit),
            creditBalance: d(g._sum.credit),
          },
          update: {
            debitBalance: d(g._sum.debit),
            creditBalance: d(g._sum.credit),
          },
        });
      }

      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) throw new BadRequestException("Organization not found");
      const nextSettings = mergeClosedPeriod(
        org.settings,
        key,
        ledgerEnum,
        book.id,
      );
      await tx.organization.update({
        where: { id: organizationId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      });
      return { depreciation: depResult, intangibleAmortization: iaResult };
    });

    return {
      closedPeriod: key,
      ledgerType: ledgerEnum,
      accountingBookId: book.id,
      transactionsMarked: true,
      depreciation: dep.depreciation,
      intangibleAmortization: dep.intangibleAmortization,
    };
  }

  /**
   * Reopen a previously closed month for one ledger (inverse of closePeriod).
   * Clears closedPeriodsByLedger key and unlocks txs that were locked solely for this book.
   */
  async reopenPeriod(
    organizationId: string,
    year: number,
    month: number,
    ledgerType: "NAS" | "IFRS" | "MANAGEMENT" = "NAS",
    accountingBookId?: string,
  ) {
    if (month < 1 || month > 12) {
      throw new BadRequestException("month must be 1-12");
    }
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const { start, end } = monthRangeUtc(year, month);
    const book = await this.accountingBooks.resolveByIdOrLedgerAlias(
      organizationId,
      accountingBookId,
      ledgerType,
    );
    const ledgerEnum =
      book.gaapKind === "IFRS"
        ? LedgerType.IFRS
        : book.gaapKind === "MANAGEMENT"
          ? LedgerType.MANAGEMENT
          : LedgerType.NAS;

    await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) throw new BadRequestException("Organization not found");
      const closed = getClosedPeriodKeys(
        org.settings,
        ledgerEnum,
        book.id,
      );
      if (!closed.includes(key)) {
        throw new BadRequestException(
          `Period ${key} is not closed for ${ledgerType}`,
        );
      }
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          settings: unmergeClosedPeriod(
            org.settings,
            key,
            ledgerEnum,
            book.id,
          ) as Prisma.InputJsonValue,
        },
      });

      const txs = await tx.journalEntry.findMany({
        where: {
          organizationId,
          ledgerType: ledgerEnum,
          accountingBookId: book.id,
          transaction: {
            organizationId,
            date: { gte: start, lte: end },
            isLocked: true,
          },
        },
        select: { transactionId: true },
        distinct: ["transactionId"],
      });
      let txIds = txs.map((t) => t.transactionId);
      if (ledgerEnum === LedgerType.IFRS && txIds.length > 0) {
        const withNas = await tx.journalEntry.findMany({
          where: {
            organizationId,
            ledgerType: LedgerType.NAS,
            transactionId: { in: txIds },
          },
          select: { transactionId: true },
          distinct: ["transactionId"],
        });
        const nasSet = new Set(withNas.map((x) => x.transactionId));
        txIds = txIds.filter((id) => !nasSet.has(id));
      }
      if (txIds.length > 0) {
        await tx.transaction.updateMany({
          where: { id: { in: txIds }, organizationId },
          data: { isLocked: false },
        });
      }
    });

    return { reopenedPeriod: key, ledgerType: ledgerEnum, accountingBookId: book.id };
  }

  /**
   * AP aging on supplier payables (531): open credit balance per purchase transaction,
   * aged by document date buckets 0-30 / 31-60 / 61-90 / 90+.
   */
  async accountsPayableAging(
    organizationId: string,
    asOfIso?: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(organizationId, ledgerType, accountingBookId);
    ledgerType = scope.ledgerType;
    const today = asOfIso?.trim() ? parseIsoDateOnly(asOfIso) : new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const asOfEnd = endOfUtcDay(new Date(todayUtc));

    const supplierPayableCode = await this.posting.resolveAccountCode(
      organizationId,
      "SUPPLIER_PAYABLE",
    );
    let payableCode = supplierPayableCode;
    if (ledgerType === LedgerType.IFRS) {
      const nasBook = await this.accountingBooks.resolveByIdOrLedgerAlias(
        organizationId,
        undefined,
        LedgerType.NAS,
      );
      const nasAcc = await this.prisma.account.findFirst({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          accountingBookId: nasBook.id,
          code: supplierPayableCode,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (nasAcc) {
        const mapLine = await this.prisma.ledgerMappingLine.findFirst({
          where: {
            sourceAccountId: nasAcc.id,
            mappingSet: {
              organizationId,
              code: "NAS_TO_IFRS",
              status: "PUBLISHED",
            },
            targetAccount: { deletedAt: null },
          },
          select: { targetAccount: { select: { code: true } } },
        });
        if (mapLine?.targetAccount.code) {
          payableCode = mapLine.targetAccount.code;
        }
      }
    }
    const acc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: payableCode,
      },
    });
    if (!acc) {
      return {
        asOf: new Date(todayUtc).toISOString().slice(0, 10),
        ledgerType,
        accountingBookId: scope.accountingBookId,
        rows: [],
        totals: {
          bucket0to30: "0.0000",
          bucket31to60: "0.0000",
          bucket61to90: "0.0000",
          bucket90plus: "0.0000",
          total: "0.0000",
        },
        methodologyNote:
          ledgerType === LedgerType.IFRS
            ? "Supplier payable account not found in IFRS chart (map SUPPLIER_PAYABLE via NAS_TO_IFRS)."
            : "Supplier payable account (SUPPLIER_PAYABLE) not found in NAS chart of accounts.",
      };
    }

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        accountId: acc.id,
        transaction: {
          date: { lte: asOfEnd },
          counterpartyId: { not: null },
        },
      },
      select: {
        debit: true,
        credit: true,
        transaction: {
          select: {
            id: true,
            date: true,
            counterpartyId: true,
            counterparty: {
              select: { id: true, nameCipher: true, taxIdCipher: true },
            },
          },
        },
      },
    });

    type Bucket = {
      b0_30: Decimal;
      b31_60: Decimal;
      b61_90: Decimal;
      b90_plus: Decimal;
    };
    type TxAgg = {
      counterpartyId: string;
      name: string;
      taxId: string;
      date: Date;
      net: Decimal;
    };
    const byTx = new Map<string, TxAgg>();

    for (const e of entries) {
      const tx = e.transaction;
      const cpId = tx.counterpartyId;
      if (!cpId || !tx.counterparty) continue;
      const net = new Decimal(e.credit.toString()).sub(
        new Decimal(e.debit.toString()),
      );
      const cur = byTx.get(tx.id) ?? {
        counterpartyId: cpId,
        name: tx.counterparty.nameCipher
          ? decryptText(tx.counterparty.nameCipher) ?? ""
          : "",
        taxId: tx.counterparty.taxIdCipher
          ? decryptText(tx.counterparty.taxIdCipher) ?? ""
          : "",
        date: tx.date,
        net: new Decimal(0),
      };
      cur.net = cur.net.add(net);
      byTx.set(tx.id, cur);
    }

    const byCp = new Map<
      string,
      { name: string; taxId: string; buckets: Bucket }
    >();

    for (const agg of byTx.values()) {
      if (agg.net.lte(0)) continue;
      const docUtc = Date.UTC(
        agg.date.getUTCFullYear(),
        agg.date.getUTCMonth(),
        agg.date.getUTCDate(),
      );
      const daysPast = Math.max(
        0,
        Math.floor((todayUtc - docUtc) / 86400000),
      );
      let bucket: keyof Bucket;
      if (daysPast <= 30) bucket = "b0_30";
      else if (daysPast <= 60) bucket = "b31_60";
      else if (daysPast <= 90) bucket = "b61_90";
      else bucket = "b90_plus";

      const cur = byCp.get(agg.counterpartyId) ?? {
        name: agg.name,
        taxId: agg.taxId,
        buckets: {
          b0_30: new Decimal(0),
          b31_60: new Decimal(0),
          b61_90: new Decimal(0),
          b90_plus: new Decimal(0),
        },
      };
      cur.buckets[bucket] = cur.buckets[bucket].add(agg.net);
      byCp.set(agg.counterpartyId, cur);
    }

    const rows = [...byCp.entries()].map(([counterpartyId, v]) => ({
      counterpartyId,
      name: v.name,
      taxId: v.taxId,
      bucket0to30: v.buckets.b0_30.toFixed(4),
      bucket31to60: v.buckets.b31_60.toFixed(4),
      bucket61to90: v.buckets.b61_90.toFixed(4),
      bucket90plus: v.buckets.b90_plus.toFixed(4),
      total: v.buckets.b0_30
        .add(v.buckets.b31_60)
        .add(v.buckets.b61_90)
        .add(v.buckets.b90_plus)
        .toFixed(4),
    }));

    rows.sort((a, b) => Number(b.total) - Number(a.total));

    const sum = rows.reduce(
      (acc, r) => ({
        bucket0to30: acc.bucket0to30.add(new Decimal(r.bucket0to30)),
        bucket31to60: acc.bucket31to60.add(new Decimal(r.bucket31to60)),
        bucket61to90: acc.bucket61to90.add(new Decimal(r.bucket61to90)),
        bucket90plus: acc.bucket90plus.add(new Decimal(r.bucket90plus)),
        total: acc.total.add(new Decimal(r.total)),
      }),
      {
        bucket0to30: new Decimal(0),
        bucket31to60: new Decimal(0),
        bucket61to90: new Decimal(0),
        bucket90plus: new Decimal(0),
        total: new Decimal(0),
      },
    );

    return {
      asOf: new Date(todayUtc).toISOString().slice(0, 10),
      ledgerType,
      accountingBookId: scope.accountingBookId,
      rows,
      totals: {
        bucket0to30: sum.bucket0to30.toFixed(4),
        bucket31to60: sum.bucket31to60.toFixed(4),
        bucket61to90: sum.bucket61to90.toFixed(4),
        bucket90plus: sum.bucket90plus.toFixed(4),
        total: sum.total.toFixed(4),
      },
      methodologyNote:
        "AP 531 by transaction with counterparty; buckets from document date: 0-30, 31-60, 61-90, 90+.",
    };
  }

  /**
   * Creditor payment plan: unpaid supplier payables with suggested pay date
   * = asOf+7 when no explicit due date.
   */
  async creditorPaymentPlan(
    organizationId: string,
    asOfIso?: string,
    ledgerType: LedgerType = LedgerType.NAS,
    accountingBookId?: string,
  ) {
    const scope = await this.resolveBookScope(organizationId, ledgerType, accountingBookId);
    ledgerType = scope.ledgerType;
    const today = asOfIso?.trim() ? parseIsoDateOnly(asOfIso) : new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const asOfEnd = endOfUtcDay(new Date(todayUtc));
    const suggestedDefault = new Date(todayUtc + 7 * 86400000)
      .toISOString()
      .slice(0, 10);

    const supplierPayableCode = await this.posting.resolveAccountCode(
      organizationId,
      "SUPPLIER_PAYABLE",
    );
    const acc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        code: supplierPayableCode,
      },
    });
    if (!acc) {
      return {
        asOf: new Date(todayUtc).toISOString().slice(0, 10),
        ledgerType,
        accountingBookId: scope.accountingBookId,
        rows: [],
      };
    }

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType,
        accountingBookId: scope.accountingBookId,
        accountId: acc.id,
        transaction: {
          date: { lte: asOfEnd },
          counterpartyId: { not: null },
        },
      },
      select: {
        debit: true,
        credit: true,
        transaction: {
          select: {
            id: true,
            date: true,
            reference: true,
            description: true,
            counterpartyId: true,
            counterparty: {
              select: { id: true, nameCipher: true, taxIdCipher: true },
            },
          },
        },
      },
    });

    type RowAgg = {
      transactionId: string;
      counterpartyId: string;
      name: string;
      taxId: string;
      documentDate: string;
      reference: string | null;
      description: string | null;
      outstanding: Decimal;
    };
    const byTx = new Map<string, RowAgg>();

    for (const e of entries) {
      const tx = e.transaction;
      if (!tx.counterpartyId || !tx.counterparty) continue;
      const net = new Decimal(e.credit.toString()).sub(
        new Decimal(e.debit.toString()),
      );
      const cur = byTx.get(tx.id) ?? {
        transactionId: tx.id,
        counterpartyId: tx.counterpartyId,
        name: tx.counterparty.nameCipher
          ? decryptText(tx.counterparty.nameCipher) ?? ""
          : "",
        taxId: tx.counterparty.taxIdCipher
          ? decryptText(tx.counterparty.taxIdCipher) ?? ""
          : "",
        documentDate: tx.date.toISOString().slice(0, 10),
        reference: tx.reference,
        description: tx.description,
        outstanding: new Decimal(0),
      };
      cur.outstanding = cur.outstanding.add(net);
      byTx.set(tx.id, cur);
    }

    const rows = [...byTx.values()]
      .filter((r) => r.outstanding.gt(0))
      .map((r) => ({
        transactionId: r.transactionId,
        counterpartyId: r.counterpartyId,
        name: r.name,
        taxId: r.taxId,
        documentDate: r.documentDate,
        reference: r.reference,
        description: r.description,
        outstanding: r.outstanding.toFixed(4),
        suggestedPayDate: suggestedDefault,
      }))
      .sort((a, b) => a.documentDate.localeCompare(b.documentDate));

    return {
      asOf: new Date(todayUtc).toISOString().slice(0, 10),
      ledgerType,
      accountingBookId: scope.accountingBookId,
      rows,
      methodologyNote:
        "Unpaid AP 531 by transaction; suggestedPayDate = asOf+7 when no explicit due date.",
    };
  }

  /**
   * EQF registry: sales invoices with e-qaime / DVX sync fields, filterable by debtor.
   */
  async listEqfRegistry(
    organizationId: string,
    opts?: { counterpartyId?: string; status?: string },
  ) {
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      isInternational: false,
      currency: "AZN",
    };
    if (opts?.counterpartyId?.trim()) {
      where.counterpartyId = opts.counterpartyId.trim();
    }
    if (opts?.status?.trim()) {
      where.eqaimeStatus = opts.status.trim() as EqaimeStatus;
    }

    const rows = await this.prisma.invoice.findMany({
      where,
      orderBy: [{ counterpartyId: "asc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        number: true,
        status: true,
        totalAmount: true,
        currency: true,
        dueDate: true,
        createdAt: true,
        counterpartyId: true,
        eqaimeNumber: true,
        eqaimeStatus: true,
        eqaimeSubmittedAt: true,
        dvxExternalId: true,
        dvxSyncStatus: true,
        dvxSyncedAt: true,
        dvxSyncError: true,
        counterparty: {
          select: { id: true, nameCipher: true, taxIdCipher: true },
        },
      },
    });

    const items = rows.map((inv) => {
      const name = inv.counterparty.nameCipher
        ? decryptText(inv.counterparty.nameCipher) ?? ""
        : "";
      const taxId = inv.counterparty.taxIdCipher
        ? decryptText(inv.counterparty.taxIdCipher)
        : null;
      return {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        totalAmount: inv.totalAmount.toFixed(4),
        currency: inv.currency,
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        createdAt: inv.createdAt.toISOString(),
        counterpartyId: inv.counterpartyId,
        counterparty: {
          id: inv.counterparty.id,
          name,
          taxId,
        },
        eqaimeNumber: inv.eqaimeNumber,
        eqaimeStatus: inv.eqaimeStatus,
        eqaimeSubmittedAt: inv.eqaimeSubmittedAt?.toISOString() ?? null,
        dvxExternalId: inv.dvxExternalId,
        dvxSyncStatus: inv.dvxSyncStatus,
        dvxSyncedAt: inv.dvxSyncedAt?.toISOString() ?? null,
        dvxSyncError: inv.dvxSyncError,
      };
    });

    const byCounterparty = new Map<
      string,
      {
        counterpartyId: string;
        counterpartyName: string;
        counterpartyTaxId: string | null;
        invoices: typeof items;
      }
    >();
    for (const item of items) {
      const g = byCounterparty.get(item.counterpartyId) ?? {
        counterpartyId: item.counterpartyId,
        counterpartyName: item.counterparty.name,
        counterpartyTaxId: item.counterparty.taxId,
        invoices: [],
      };
      g.invoices.push(item);
      byCounterparty.set(item.counterpartyId, g);
    }

    const s2sRaw = this.config.get<string>("ERA_EQAIME_S2S_ENABLED", "0");
    const s2sEnabled = s2sRaw === "1" || s2sRaw?.toLowerCase() === "true";

    return {
      total: items.length,
      items,
      groups: Array.from(byCounterparty.values()),
      s2sEnabled,
    };
  }
}
