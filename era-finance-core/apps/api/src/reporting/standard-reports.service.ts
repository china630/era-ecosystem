import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Decimal,
  LedgerType,
  pickAccountDisplayName,
  Prisma,
  SubcontoKind,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubcontoService } from "../accounting/subconto.service";
import { decryptText } from "../security/pii-crypto.util";
import {
  getClosedPeriodKeys,
  parseIsoDateOnly,
} from "./reporting-period.util";

function counterpartyDisplayName(nameCipher: string | null | undefined): string {
  if (!nameCipher) return "";
  return decryptText(nameCipher) ?? "";
}

function d(v: Decimal | null | undefined): Decimal {
  return v ?? new Decimal(0);
}

function netDrMinusCr(sumDr: Decimal, sumCr: Decimal): Decimal {
  return sumDr.sub(sumCr);
}

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

function parsePeriod(
  dateFromStr: string,
  dateToStr: string,
): { dateFrom: Date; dateTo: Date } {
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
  return { dateFrom, dateTo };
}

export type AnalysisDimension = "counterparty" | "department";

const SUBCONTO_DISABLED_NOTE =
  "ERA_SUBCONTO_ENABLED is off; configure the flag and account subconto bindings to use per-line dimensions. Account-level aggregates are returned where applicable.";
const SUBCONTO_EMPTY_NOTE =
  "No journal line dimensions match the filter. Run dimension backfill or post new entries with dimensions.";

type DimensionRow = {
  subcontoTypeId: string;
  valueId: string | null;
  valueRef: string | null;
  subcontoType: { id: string; code: string; name: string; kind: SubcontoKind };
};

type SubcontoBucketKey = string;

@Injectable()
export class StandardReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subconto: SubcontoService,
  ) {}

  private async resolveOpeningMap(
    organizationId: string,
    ledgerType: LedgerType,
    accountIds: string[],
    dateFrom: Date,
  ): Promise<Map<string, { dr: Decimal; cr: Decimal }>> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closedKeys = getClosedPeriodKeys(org?.settings);
    const closedEnds = closedKeys
      .map(parseClosedPeriodEnd)
      .filter((x): x is Date => x != null)
      .filter((x) => x.getTime() < dateFrom.getTime())
      .sort((a, b) => b.getTime() - a.getTime());
    const snapshotDate = closedEnds[0] ?? null;

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
          accountId: { in: accountIds },
          transaction: { date: { lt: dateFrom }, isFinal: true },
        },
        _sum: { debit: true, credit: true },
      });
      openingMap = new Map(
        openingAgg.map((r) => [
          r.accountId,
          { dr: d(r._sum.debit), cr: d(r._sum.credit) },
        ]),
      );
    }
    return openingMap;
  }

  private async resolveAccount(
    organizationId: string,
    ledgerType: LedgerType,
    accountCode: string,
  ) {
    const code = accountCode?.trim();
    if (!code) {
      throw new BadRequestException("accountCode is required");
    }
    const account = await this.prisma.account.findFirst({
      where: { organizationId, ledgerType, code },
    });
    if (!account) {
      throw new BadRequestException(`Account not found: ${code}`);
    }
    return account;
  }

  /**
   * Account card (карточка счёта): lines with running balance.
   */
  async accountCard(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    accountCode: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);
    const account = await this.resolveAccount(
      organizationId,
      ledgerType,
      accountCode,
    );

    const openingMap = await this.resolveOpeningMap(
      organizationId,
      ledgerType,
      [account.id],
      dateFrom,
    );
    const o = openingMap.get(account.id) ?? {
      dr: new Decimal(0),
      cr: new Decimal(0),
    };
    const openingNet = netDrMinusCr(o.dr, o.cr);
    const opening = splitDrCr(openingNet);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType,
        accountId: account.id,
        transaction: {
          date: { gte: dateFrom, lte: dateTo },
          isFinal: true,
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            reference: true,
            description: true,
            counterpartyId: true,
            departmentId: true,
            counterparty: { select: { id: true, nameCipher: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ transaction: { date: "asc" } }, { createdAt: "asc" }],
    });

    let running = openingNet;
    const lines = entries.map((e) => {
      const debit = d(e.debit);
      const credit = d(e.credit);
      running = running.add(debit).sub(credit);
      const bal = splitDrCr(running);
      return {
        journalEntryId: e.id,
        transactionId: e.transactionId,
        date: e.transaction.date.toISOString().slice(0, 10),
        reference: e.transaction.reference,
        description: e.transaction.description,
        counterpartyId: e.transaction.counterpartyId,
        counterpartyName: e.transaction.counterparty
          ? counterpartyDisplayName(e.transaction.counterparty.nameCipher) || null
          : null,
        departmentId: e.transaction.departmentId,
        departmentName: e.transaction.department?.name ?? null,
        debit: debit.toFixed(4),
        credit: credit.toFixed(4),
        balanceDebit: bal.debit.toFixed(4),
        balanceCredit: bal.credit.toFixed(4),
      };
    });

    const periodDebit = entries.reduce(
      (s, e) => s.add(d(e.debit)),
      new Decimal(0),
    );
    const periodCredit = entries.reduce(
      (s, e) => s.add(d(e.credit)),
      new Decimal(0),
    );
    const closing = splitDrCr(running);

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      account: {
        id: account.id,
        code: account.code,
        name: pickAccountDisplayName(account, "ru"),
        type: account.type,
      },
      opening: {
        debit: opening.debit.toFixed(4),
        credit: opening.credit.toFixed(4),
      },
      period: {
        debit: periodDebit.toFixed(4),
        credit: periodCredit.toFixed(4),
      },
      closing: {
        debit: closing.debit.toFixed(4),
        credit: closing.credit.toFixed(4),
      },
      lines,
      note:
        "Per-line subconto dimensions are available via GET /reporting/subconto/account-card when ERA_SUBCONTO_ENABLED is on.",
    };
  }

  /**
   * Account turnovers (обороты счёта / оборотная ведомость) — same shape as TB rows.
   */
  async accountTurnovers(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, ledgerType },
      orderBy: { code: "asc" },
    });
    if (accounts.length === 0) {
      return {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        ledgerType,
        rows: [],
      };
    }
    const accountIds = accounts.map((a) => a.id);
    const openingMap = await this.resolveOpeningMap(
      organizationId,
      ledgerType,
      accountIds,
      dateFrom,
    );
    const periodAgg = await this.prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        organizationId,
        ledgerType,
        accountId: { in: accountIds },
        transaction: {
          date: { gte: dateFrom, lte: dateTo },
          isFinal: true,
        },
      },
      _sum: { debit: true, credit: true },
    });
    const periodMap = new Map(
      periodAgg.map((r) => [
        r.accountId,
        { dr: d(r._sum.debit), cr: d(r._sum.credit) },
      ]),
    );

    const rows = accounts
      .map((acc) => {
        const o = openingMap.get(acc.id) ?? {
          dr: new Decimal(0),
          cr: new Decimal(0),
        };
        const p = periodMap.get(acc.id) ?? {
          dr: new Decimal(0),
          cr: new Decimal(0),
        };
        const openingNet = netDrMinusCr(o.dr, o.cr);
        const closingNet = openingNet.add(p.dr).sub(p.cr);
        const ob = splitDrCr(openingNet);
        const cb = splitDrCr(closingNet);
        const hasActivity =
          !openingNet.isZero() || !p.dr.isZero() || !p.cr.isZero();
        return {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: pickAccountDisplayName(acc, "ru"),
          accountType: acc.type,
          openingDebit: ob.debit.toFixed(4),
          openingCredit: ob.credit.toFixed(4),
          periodDebit: p.dr.toFixed(4),
          periodCredit: p.cr.toFixed(4),
          closingDebit: cb.debit.toFixed(4),
          closingCredit: cb.credit.toFixed(4),
          hasActivity,
        };
      })
      .filter((r) => r.hasActivity);

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      rows,
    };
  }

  /**
   * Account analysis by existing Transaction dimensions (counterparty | department).
   * Project/cost-center subconto per journal line — see E4.
   */
  async accountAnalysis(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    accountCode: string,
    dimension: AnalysisDimension,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);
    if (dimension !== "counterparty" && dimension !== "department") {
      throw new BadRequestException(
        "dimension must be counterparty or department (project/subconto — see E4)",
      );
    }
    const account = await this.resolveAccount(
      organizationId,
      ledgerType,
      accountCode,
    );

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType,
        accountId: account.id,
        transaction: {
          date: { gte: dateFrom, lte: dateTo },
          isFinal: true,
        },
      },
      select: {
        debit: true,
        credit: true,
        transaction: {
          select: {
            counterpartyId: true,
            departmentId: true,
            counterparty: { select: { id: true, nameCipher: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    type Bucket = {
      id: string | null;
      name: string;
      debit: Decimal;
      credit: Decimal;
    };
    const map = new Map<string, Bucket>();

    for (const e of entries) {
      const dimId =
        dimension === "counterparty"
          ? e.transaction.counterpartyId
          : e.transaction.departmentId;
      const dimName =
        dimension === "counterparty"
          ? counterpartyDisplayName(e.transaction.counterparty?.nameCipher) ||
            "(no counterparty)"
          : (e.transaction.department?.name ?? "(no department)");
      const key = dimId ?? "__null__";
      const bucket = map.get(key) ?? {
        id: dimId,
        name: dimName,
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      bucket.debit = bucket.debit.add(d(e.debit));
      bucket.credit = bucket.credit.add(d(e.credit));
      map.set(key, bucket);
    }

    const rows = [...map.values()]
      .map((b) => {
        const net = netDrMinusCr(b.debit, b.credit);
        const split = splitDrCr(net);
        return {
          dimensionId: b.id,
          dimensionName: b.name,
          periodDebit: b.debit.toFixed(4),
          periodCredit: b.credit.toFixed(4),
          netDebit: split.debit.toFixed(4),
          netCredit: split.credit.toFixed(4),
        };
      })
      .sort((a, b) => a.dimensionName.localeCompare(b.dimensionName));

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      account: {
        id: account.id,
        code: account.code,
        name: pickAccountDisplayName(account, "ru"),
      },
      dimension,
      rows,
      note:
        "Per-line subconto dimensions are available via GET /reporting/subconto/* when ERA_SUBCONTO_ENABLED is on. Header counterparty/department analysis remains on GET /reporting/account-analysis.",
    };
  }

  /**
   * Chessboard (шахматка): debit account × credit account within the same Transaction.
   * For multi-line journals, amounts are distributed by pairing debit lines with credit
   * lines proportionally to transaction totals (approximate for complex entries).
   */
  async chessboard(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);

    const txs = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        date: { gte: dateFrom, lte: dateTo },
        isFinal: true,
      },
      select: {
        id: true,
        journalEntries: {
          where: { ledgerType },
          select: {
            accountId: true,
            debit: true,
            credit: true,
            account: { select: { code: true } },
          },
        },
      },
    });

    /** key: `${debitCode}|${creditCode}` → amount */
    const cellMap = new Map<string, Decimal>();
    const codes = new Set<string>();
    let approximatePairCount = 0;
    let exactPairCount = 0;

    for (const tx of txs) {
      const debits = tx.journalEntries
        .filter((e) => d(e.debit).gt(0))
        .map((e) => ({
          code: e.account.code,
          amount: d(e.debit),
        }));
      const credits = tx.journalEntries
        .filter((e) => d(e.credit).gt(0))
        .map((e) => ({
          code: e.account.code,
          amount: d(e.credit),
        }));
      if (debits.length === 0 || credits.length === 0) continue;

      const totalDebit = debits.reduce(
        (s, x) => s.add(x.amount),
        new Decimal(0),
      );
      const totalCredit = credits.reduce(
        (s, x) => s.add(x.amount),
        new Decimal(0),
      );
      if (totalDebit.isZero() || totalCredit.isZero()) continue;

      const isExact = debits.length === 1 && credits.length === 1;
      if (isExact) exactPairCount += 1;
      else approximatePairCount += 1;

      for (const dr of debits) {
        for (const cr of credits) {
          // Distribute: share of this debit × share of this credit × min(totalDr,totalCr)
          // Equivalent: (dr.amount / totalDebit) * (cr.amount / totalCredit) * totalDebit
          //           = dr.amount * (cr.amount / totalCredit)
          const amount = dr.amount.mul(cr.amount).div(totalCredit);
          if (amount.isZero()) continue;
          codes.add(dr.code);
          codes.add(cr.code);
          const key = `${dr.code}|${cr.code}`;
          cellMap.set(key, (cellMap.get(key) ?? new Decimal(0)).add(amount));
        }
      }
    }

    const accountCodes = [...codes].sort();
    const cells = [...cellMap.entries()]
      .map(([key, amount]) => {
        const [debitAccountCode, creditAccountCode] = key.split("|");
        return {
          debitAccountCode,
          creditAccountCode,
          amount: amount.toFixed(4),
        };
      })
      .sort((a, b) =>
        a.debitAccountCode === b.debitAccountCode
          ? a.creditAccountCode.localeCompare(b.creditAccountCode)
          : a.debitAccountCode.localeCompare(b.debitAccountCode),
      );

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      accountCodes,
      cells,
      methodology: {
        note:
          "For 1:1 postings the cell is exact. For multi-line journals amounts are distributed proportionally across debit×credit pairs within the same transaction.",
        exactPairTransactions: exactPairCount,
        approximatePairTransactions: approximatePairCount,
      },
    };
  }

  /**
   * General ledger / journal of entries (журнал проводок / главная книга).
   */
  async generalLedger(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    ledgerType: LedgerType = LedgerType.NAS,
    opts?: {
      accountCode?: string;
      counterpartyId?: string;
      departmentId?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);
    const skip = Math.max(0, opts?.skip ?? 0);
    const take = Math.min(Math.max(1, opts?.take ?? 200), 1000);

    let accountId: string | undefined;
    if (opts?.accountCode?.trim()) {
      const acc = await this.resolveAccount(
        organizationId,
        ledgerType,
        opts.accountCode,
      );
      accountId = acc.id;
    }

    const where: Prisma.JournalEntryWhereInput = {
      organizationId,
      ledgerType,
      ...(accountId ? { accountId } : {}),
      transaction: {
        date: { gte: dateFrom, lte: dateTo },
        isFinal: true,
        ...(opts?.counterpartyId
          ? { counterpartyId: opts.counterpartyId }
          : {}),
        ...(opts?.departmentId ? { departmentId: opts.departmentId } : {}),
      },
    };

    const [total, entries] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              code: true,
              nameAz: true,
              nameRu: true,
              nameEn: true,
              type: true,
            },
          },
          transaction: {
            select: {
              id: true,
              date: true,
              reference: true,
              description: true,
              counterpartyId: true,
              departmentId: true,
              counterparty: { select: { id: true, nameCipher: true } },
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          { transaction: { date: "asc" } },
          { transactionId: "asc" },
          { createdAt: "asc" },
        ],
        skip,
        take,
      }),
    ]);

    const lines = entries.map((e) => ({
      journalEntryId: e.id,
      transactionId: e.transactionId,
      date: e.transaction.date.toISOString().slice(0, 10),
      reference: e.transaction.reference,
      description: e.transaction.description,
      accountId: e.account.id,
      accountCode: e.account.code,
      accountName: pickAccountDisplayName(e.account, "ru"),
      debit: d(e.debit).toFixed(4),
      credit: d(e.credit).toFixed(4),
      counterpartyId: e.transaction.counterpartyId,
      counterpartyName: e.transaction.counterparty
        ? counterpartyDisplayName(e.transaction.counterparty.nameCipher) || null
        : null,
      departmentId: e.transaction.departmentId,
      departmentName: e.transaction.department?.name ?? null,
    }));

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      total,
      skip,
      take,
      lines,
    };
  }

  private subcontoBucketKey(
    accountId: string,
    dim: Pick<DimensionRow, "subcontoTypeId" | "valueId" | "valueRef">,
  ): SubcontoBucketKey {
    return `${accountId}|${dim.subcontoTypeId}|${dim.valueId ?? ""}|${dim.valueRef ?? ""}`;
  }

  private pickDimensionForFilter(
    dimensions: DimensionRow[],
    subcontoTypeId?: string,
  ): DimensionRow | null {
    if (!dimensions.length) return null;
    if (subcontoTypeId?.trim()) {
      return (
        dimensions.find((d) => d.subcontoTypeId === subcontoTypeId.trim()) ??
        null
      );
    }
    return dimensions[0] ?? null;
  }

  private dimensionWhere(
    subcontoTypeId?: string,
    valueId?: string,
  ): Prisma.JournalEntryDimensionWhereInput | undefined {
    if (!subcontoTypeId?.trim()) return undefined;
    return {
      subcontoTypeId: subcontoTypeId.trim(),
      ...(valueId?.trim() ? { valueId: valueId.trim() } : {}),
    };
  }

  private async resolveSubcontoType(
    organizationId: string,
    subcontoTypeId: string,
  ) {
    const row = await this.prisma.subcontoType.findFirst({
      where: { id: subcontoTypeId, organizationId },
    });
    if (!row) {
      throw new BadRequestException("Subconto type not found");
    }
    return row;
  }

  private async buildDimensionLabelMap(
    organizationId: string,
    refs: Array<{
      kind: SubcontoKind;
      valueId: string | null;
      valueRef: string | null;
    }>,
  ): Promise<Map<string, string>> {
    const keyOf = (
      kind: SubcontoKind,
      valueId: string | null,
      valueRef: string | null,
    ) => `${kind}|${valueId ?? ""}|${valueRef ?? ""}`;
    const map = new Map<string, string>();
    const cpIds = new Set<string>();
    const deptIds = new Set<string>();
    const projIds = new Set<string>();
    const itemIds = new Set<string>();

    for (const ref of refs) {
      if (!ref.valueId) {
        map.set(
          keyOf(ref.kind, ref.valueId, ref.valueRef),
          ref.valueRef?.trim() || "(no value)",
        );
        continue;
      }
      switch (ref.kind) {
        case SubcontoKind.COUNTERPARTY:
          cpIds.add(ref.valueId);
          break;
        case SubcontoKind.COST_CENTER:
          deptIds.add(ref.valueId);
          break;
        case SubcontoKind.PROJECT:
          projIds.add(ref.valueId);
          break;
        case SubcontoKind.ITEM:
          itemIds.add(ref.valueId);
          break;
        case SubcontoKind.EMPLOYEE:
          map.set(keyOf(ref.kind, ref.valueId, ref.valueRef), ref.valueId);
          break;
        case SubcontoKind.CUSTOM:
          map.set(
            keyOf(ref.kind, ref.valueId, ref.valueRef),
            ref.valueRef?.trim() || ref.valueId,
          );
          break;
        default:
          map.set(keyOf(ref.kind, ref.valueId, ref.valueRef), ref.valueId);
      }
    }

    if (cpIds.size > 0) {
      const rows = await this.prisma.counterparty.findMany({
        where: { organizationId, id: { in: [...cpIds] } },
        select: { id: true, nameCipher: true },
      });
      for (const r of rows) {
        map.set(
          keyOf(SubcontoKind.COUNTERPARTY, r.id, null),
          counterpartyDisplayName(r.nameCipher) || r.id,
        );
      }
    }
    if (deptIds.size > 0) {
      const rows = await this.prisma.department.findMany({
        where: { organizationId, id: { in: [...deptIds] } },
        select: { id: true, name: true },
      });
      for (const r of rows) {
        map.set(keyOf(SubcontoKind.COST_CENTER, r.id, null), r.name);
      }
    }
    if (projIds.size > 0) {
      const rows = await this.prisma.psaProject.findMany({
        where: { organizationId, id: { in: [...projIds] } },
        select: { id: true, name: true },
      });
      for (const r of rows) {
        map.set(keyOf(SubcontoKind.PROJECT, r.id, null), r.name);
      }
    }
    if (itemIds.size > 0) {
      const rows = await this.prisma.product.findMany({
        where: { organizationId, id: { in: [...itemIds] } },
        select: { id: true, name: true },
      });
      for (const r of rows) {
        map.set(keyOf(SubcontoKind.ITEM, r.id, null), r.name);
      }
    }

    for (const ref of refs) {
      const k = keyOf(ref.kind, ref.valueId, ref.valueRef);
      if (!map.has(k)) {
        map.set(k, ref.valueRef?.trim() || ref.valueId || "(unknown)");
      }
    }
    return map;
  }

  private async aggregateSubcontoBuckets(
    organizationId: string,
    ledgerType: LedgerType,
    dateFrom: Date,
    dateTo: Date,
    opts: {
      accountId?: string;
      subcontoTypeId?: string;
      valueId?: string;
    },
  ) {
    const dimFilter = this.dimensionWhere(opts.subcontoTypeId, opts.valueId);
    const dimensionClause = dimFilter
      ? { dimensions: { some: dimFilter } }
      : { dimensions: { some: {} } };

    const [openingEntries, periodEntries, accounts] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          ledgerType,
          ...(opts.accountId ? { accountId: opts.accountId } : {}),
          ...dimensionClause,
          transaction: { isFinal: true, date: { lt: dateFrom } },
        },
        select: {
          accountId: true,
          debit: true,
          credit: true,
          dimensions: {
            include: {
              subcontoType: {
                select: { id: true, code: true, name: true, kind: true },
              },
            },
          },
        },
      }),
      this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          ledgerType,
          ...(opts.accountId ? { accountId: opts.accountId } : {}),
          ...dimensionClause,
          transaction: { isFinal: true, date: { gte: dateFrom, lte: dateTo } },
        },
        select: {
          accountId: true,
          debit: true,
          credit: true,
          dimensions: {
            include: {
              subcontoType: {
                select: { id: true, code: true, name: true, kind: true },
              },
            },
          },
        },
      }),
      this.prisma.account.findMany({
        where: {
          organizationId,
          ledgerType,
          ...(opts.accountId ? { id: opts.accountId } : {}),
        },
        select: {
          id: true,
          code: true,
          nameAz: true,
          nameRu: true,
          nameEn: true,
          type: true,
        },
      }),
    ]);

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    type Bucket = {
      accountId: string;
      dim: DimensionRow;
      openingDr: Decimal;
      openingCr: Decimal;
      periodDr: Decimal;
      periodCr: Decimal;
    };
    const buckets = new Map<string, Bucket>();

    const add = (
      entry: {
        accountId: string;
        debit: Decimal | null;
        credit: Decimal | null;
        dimensions: DimensionRow[];
      },
      phase: "opening" | "period",
    ) => {
      const dim = this.pickDimensionForFilter(
        entry.dimensions,
        opts.subcontoTypeId,
      );
      if (!dim) return;
      const key = this.subcontoBucketKey(entry.accountId, dim);
      const bucket = buckets.get(key) ?? {
        accountId: entry.accountId,
        dim,
        openingDr: new Decimal(0),
        openingCr: new Decimal(0),
        periodDr: new Decimal(0),
        periodCr: new Decimal(0),
      };
      if (phase === "opening") {
        bucket.openingDr = bucket.openingDr.add(d(entry.debit));
        bucket.openingCr = bucket.openingCr.add(d(entry.credit));
      } else {
        bucket.periodDr = bucket.periodDr.add(d(entry.debit));
        bucket.periodCr = bucket.periodCr.add(d(entry.credit));
      }
      buckets.set(key, bucket);
    };

    for (const e of openingEntries) add(e, "opening");
    for (const e of periodEntries) add(e, "period");

    return { buckets, accountMap };
  }

  /**
   * Trial balance grouped by account + subconto dimension value.
   */
  async trialBalanceBySubconto(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    accountCode?: string,
    subcontoTypeId?: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);
    const enabled = this.subconto.isEnabled();

    let accountId: string | undefined;
    if (accountCode?.trim()) {
      const acc = await this.resolveAccount(
        organizationId,
        ledgerType,
        accountCode,
      );
      accountId = acc.id;
    }

    if (!enabled) {
      const fallback = await this.accountTurnovers(
        organizationId,
        dateFromStr,
        dateToStr,
        ledgerType,
      );
      return {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        ledgerType,
        subcontoEnabled: false,
        note: SUBCONTO_DISABLED_NOTE,
        rows: [],
        fallback,
      };
    }

    const { buckets, accountMap } = await this.aggregateSubcontoBuckets(
      organizationId,
      ledgerType,
      dateFrom,
      dateTo,
      { accountId, subcontoTypeId },
    );

    if (buckets.size === 0) {
      const fallback = await this.accountTurnovers(
        organizationId,
        dateFromStr,
        dateToStr,
        ledgerType,
      );
      return {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        ledgerType,
        subcontoEnabled: true,
        note: SUBCONTO_EMPTY_NOTE,
        rows: [],
        fallback,
      };
    }

    const labelMap = await this.buildDimensionLabelMap(
      organizationId,
      [...buckets.values()].map((b) => ({
        kind: b.dim.subcontoType.kind,
        valueId: b.dim.valueId,
        valueRef: b.dim.valueRef,
      })),
    );

    const rows = [...buckets.values()]
      .map((b) => {
        const acc = accountMap.get(b.accountId);
        if (!acc) return null;
        const openingNet = netDrMinusCr(b.openingDr, b.openingCr);
        const closingNet = openingNet.add(b.periodDr).sub(b.periodCr);
        const ob = splitDrCr(openingNet);
        const cb = splitDrCr(closingNet);
        const labelKey = `${b.dim.subcontoType.kind}|${b.dim.valueId ?? ""}|${b.dim.valueRef ?? ""}`;
        return {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: pickAccountDisplayName(acc, "ru"),
          accountType: acc.type,
          subcontoTypeId: b.dim.subcontoTypeId,
          subcontoTypeCode: b.dim.subcontoType.code,
          subcontoTypeName: b.dim.subcontoType.name,
          valueId: b.dim.valueId,
          valueRef: b.dim.valueRef,
          valueName: labelMap.get(labelKey) ?? "(unknown)",
          openingDebit: ob.debit.toFixed(4),
          openingCredit: ob.credit.toFixed(4),
          periodDebit: b.periodDr.toFixed(4),
          periodCredit: b.periodCr.toFixed(4),
          closingDebit: cb.debit.toFixed(4),
          closingCredit: cb.credit.toFixed(4),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) =>
        a.accountCode === b.accountCode
          ? a.valueName.localeCompare(b.valueName)
          : a.accountCode.localeCompare(b.accountCode),
      );

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      subcontoEnabled: true,
      note: null,
      rows,
    };
  }

  /**
   * Account card filtered by subconto dimension on journal lines.
   */
  async accountCardBySubconto(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    accountCode: string,
    subcontoTypeId?: string,
    valueId?: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);
    const account = await this.resolveAccount(
      organizationId,
      ledgerType,
      accountCode,
    );
    const enabled = this.subconto.isEnabled();

    if (!enabled) {
      const fallback = await this.accountCard(
        organizationId,
        dateFromStr,
        dateToStr,
        accountCode,
        ledgerType,
      );
      return {
        ...fallback,
        subcontoEnabled: false,
        note: SUBCONTO_DISABLED_NOTE,
        dimensions: [],
      };
    }

    const dimFilter = this.dimensionWhere(subcontoTypeId, valueId);
    const entryWhere: Prisma.JournalEntryWhereInput = {
      organizationId,
      ledgerType,
      accountId: account.id,
      ...(dimFilter ? { dimensions: { some: dimFilter } } : { dimensions: { some: {} } }),
      transaction: { isFinal: true },
    };

    const [openingEntries, periodEntries] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: {
          ...entryWhere,
          transaction: { isFinal: true, date: { lt: dateFrom } },
        },
        select: { debit: true, credit: true },
      }),
      this.prisma.journalEntry.findMany({
        where: {
          ...entryWhere,
          transaction: { isFinal: true, date: { gte: dateFrom, lte: dateTo } },
        },
        include: {
          dimensions: {
            include: {
              subcontoType: {
                select: { id: true, code: true, name: true, kind: true },
              },
            },
          },
          transaction: {
            select: {
              id: true,
              date: true,
              reference: true,
              description: true,
              counterpartyId: true,
              departmentId: true,
              counterparty: { select: { id: true, nameCipher: true } },
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ transaction: { date: "asc" } }, { createdAt: "asc" }],
      }),
    ]);

    if (periodEntries.length === 0 && openingEntries.length === 0) {
      const fallback = await this.accountCard(
        organizationId,
        dateFromStr,
        dateToStr,
        accountCode,
        ledgerType,
      );
      return {
        ...fallback,
        subcontoEnabled: true,
        note: SUBCONTO_EMPTY_NOTE,
        dimensions: [],
      };
    }

    const openingDr = openingEntries.reduce(
      (s, e) => s.add(d(e.debit)),
      new Decimal(0),
    );
    const openingCr = openingEntries.reduce(
      (s, e) => s.add(d(e.credit)),
      new Decimal(0),
    );
    const openingNet = netDrMinusCr(openingDr, openingCr);
    const opening = splitDrCr(openingNet);
    let running = openingNet;

    const labelMap = await this.buildDimensionLabelMap(
      organizationId,
      periodEntries.flatMap((e) =>
        e.dimensions.map((dim) => ({
          kind: dim.subcontoType.kind,
          valueId: dim.valueId,
          valueRef: dim.valueRef,
        })),
      ),
    );

    const lines = periodEntries.map((e) => {
      const debit = d(e.debit);
      const credit = d(e.credit);
      running = running.add(debit).sub(credit);
      const bal = splitDrCr(running);
      const primaryDim = this.pickDimensionForFilter(
        e.dimensions as DimensionRow[],
        subcontoTypeId,
      );
      const dimLabel = primaryDim
        ? labelMap.get(
            `${primaryDim.subcontoType.kind}|${primaryDim.valueId ?? ""}|${primaryDim.valueRef ?? ""}`,
          )
        : null;
      return {
        journalEntryId: e.id,
        transactionId: e.transactionId,
        date: e.transaction.date.toISOString().slice(0, 10),
        reference: e.transaction.reference,
        description: e.transaction.description,
        counterpartyId: e.transaction.counterpartyId,
        counterpartyName: e.transaction.counterparty
          ? counterpartyDisplayName(e.transaction.counterparty.nameCipher) || null
          : null,
        departmentId: e.transaction.departmentId,
        departmentName: e.transaction.department?.name ?? null,
        subcontoTypeId: primaryDim?.subcontoTypeId ?? null,
        subcontoTypeCode: primaryDim?.subcontoType.code ?? null,
        subcontoValueId: primaryDim?.valueId ?? null,
        subcontoValueName: dimLabel ?? null,
        debit: debit.toFixed(4),
        credit: credit.toFixed(4),
        balanceDebit: bal.debit.toFixed(4),
        balanceCredit: bal.credit.toFixed(4),
      };
    });

    const periodDebit = periodEntries.reduce(
      (s, e) => s.add(d(e.debit)),
      new Decimal(0),
    );
    const periodCredit = periodEntries.reduce(
      (s, e) => s.add(d(e.credit)),
      new Decimal(0),
    );
    const closing = splitDrCr(running);

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      subcontoEnabled: true,
      note: null,
      account: {
        id: account.id,
        code: account.code,
        name: pickAccountDisplayName(account, "ru"),
        type: account.type,
      },
      opening: {
        debit: opening.debit.toFixed(4),
        credit: opening.credit.toFixed(4),
      },
      period: {
        debit: periodDebit.toFixed(4),
        credit: periodCredit.toFixed(4),
      },
      closing: {
        debit: closing.debit.toFixed(4),
        credit: closing.credit.toFixed(4),
      },
      lines,
      dimensions: subcontoTypeId
        ? [{ subcontoTypeId, valueId: valueId ?? null }]
        : [],
    };
  }

  /**
   * Drill-down totals per subconto value for a given type (and optional account).
   */
  async subcontoAnalysis(
    organizationId: string,
    dateFromStr: string,
    dateToStr: string,
    subcontoTypeId: string,
    accountCode?: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { dateFrom, dateTo } = parsePeriod(dateFromStr, dateToStr);
    if (!subcontoTypeId?.trim()) {
      throw new BadRequestException("subcontoTypeId is required");
    }
    const subcontoType = await this.resolveSubcontoType(
      organizationId,
      subcontoTypeId,
    );
    const enabled = this.subconto.isEnabled();

    let accountId: string | undefined;
    let accountMeta:
      | { id: string; code: string; name: string }
      | undefined;
    if (accountCode?.trim()) {
      const acc = await this.resolveAccount(
        organizationId,
        ledgerType,
        accountCode,
      );
      accountId = acc.id;
      accountMeta = {
        id: acc.id,
        code: acc.code,
        name: pickAccountDisplayName(acc, "ru"),
      };
    }

    if (!enabled) {
      return {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        ledgerType,
        subcontoEnabled: false,
        note: SUBCONTO_DISABLED_NOTE,
        subcontoType: {
          id: subcontoType.id,
          code: subcontoType.code,
          name: subcontoType.name,
          kind: subcontoType.kind,
        },
        account: accountMeta ?? null,
        rows: [],
      };
    }

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType,
        ...(accountId ? { accountId } : {}),
        dimensions: { some: { subcontoTypeId: subcontoType.id } },
        transaction: {
          date: { gte: dateFrom, lte: dateTo },
          isFinal: true,
        },
      },
      select: {
        debit: true,
        credit: true,
        dimensions: {
          where: { subcontoTypeId: subcontoType.id },
          select: {
            valueId: true,
            valueRef: true,
            subcontoType: {
              select: { kind: true },
            },
          },
        },
      },
    });

    type ValueBucket = {
      valueId: string | null;
      valueRef: string | null;
      debit: Decimal;
      credit: Decimal;
    };
    const map = new Map<string, ValueBucket>();

    for (const e of entries) {
      const dim = e.dimensions[0];
      if (!dim) continue;
      const key = `${dim.valueId ?? ""}|${dim.valueRef ?? ""}`;
      const bucket = map.get(key) ?? {
        valueId: dim.valueId,
        valueRef: dim.valueRef,
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      bucket.debit = bucket.debit.add(d(e.debit));
      bucket.credit = bucket.credit.add(d(e.credit));
      map.set(key, bucket);
    }

    if (map.size === 0) {
      return {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        ledgerType,
        subcontoEnabled: true,
        note: SUBCONTO_EMPTY_NOTE,
        subcontoType: {
          id: subcontoType.id,
          code: subcontoType.code,
          name: subcontoType.name,
          kind: subcontoType.kind,
        },
        account: accountMeta ?? null,
        rows: [],
      };
    }

    const labelMap = await this.buildDimensionLabelMap(
      organizationId,
      [...map.values()].map((b) => ({
        kind: subcontoType.kind,
        valueId: b.valueId,
        valueRef: b.valueRef,
      })),
    );

    const rows = [...map.values()]
      .map((b) => {
        const net = netDrMinusCr(b.debit, b.credit);
        const split = splitDrCr(net);
        const labelKey = `${subcontoType.kind}|${b.valueId ?? ""}|${b.valueRef ?? ""}`;
        return {
          valueId: b.valueId,
          valueRef: b.valueRef,
          valueName: labelMap.get(labelKey) ?? "(unknown)",
          periodDebit: b.debit.toFixed(4),
          periodCredit: b.credit.toFixed(4),
          netDebit: split.debit.toFixed(4),
          netCredit: split.credit.toFixed(4),
        };
      })
      .sort((a, b) => a.valueName.localeCompare(b.valueName));

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      ledgerType,
      subcontoEnabled: true,
      note: null,
      subcontoType: {
        id: subcontoType.id,
        code: subcontoType.code,
        name: subcontoType.name,
        kind: subcontoType.kind,
      },
      account: accountMeta ?? null,
      rows,
    };
  }
}
