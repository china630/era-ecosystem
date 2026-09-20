import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import type { NasIfrsQueryDto } from "./dto/nas-ifrs-query.dto";

function defaultPeriod(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 86_400_000);
  return { from, to };
}

@Injectable()
export class AuditHubNasIfrsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(organizationId: string, query: NasIfrsQueryDto) {
    const take = query.take ?? 200;
    const includeTotalsMismatch = query.includeTotalsMismatch === true;
    let from = query.from ? new Date(query.from) : undefined;
    let to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({ code: "INVALID_FROM" });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({ code: "INVALID_TO" });
    }
    if (!from || !to) {
      const d = defaultPeriod();
      from = d.from;
      to = d.to;
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        transactionId: string;
        date: Date;
        reference: string | null;
        opsBookId: string;
        opsBookCode: string;
        targetBookId: string;
        targetBookCode: string;
        targetBookName: string;
        hasOps: boolean;
        hasTarget: boolean;
      }>
    >(Prisma.sql`
      WITH book_pairs AS (
        SELECT
          ops.id AS "opsBookId",
          ops.code AS "opsBookCode",
          target.id AS "targetBookId",
          target.code AS "targetBookCode",
          COALESCE(target.name_en, target.name_ru, target.name_az, target.code) AS "targetBookName"
        FROM accounting_books ops
        INNER JOIN accounting_books target
          ON target.organization_id = ops.organization_id
          AND target.status = CAST('ACTIVE' AS "AccountingBookStatus")
          AND target.is_default_ops = false
        WHERE ops.organization_id = ${organizationId}::uuid
          AND ops.status = CAST('ACTIVE' AS "AccountingBookStatus")
          AND ops.is_default_ops = true
      )
      SELECT
        t.id AS "transactionId",
        t.date AS "date",
        t.reference AS "reference",
        bp."opsBookId",
        bp."opsBookCode",
        bp."targetBookId",
        bp."targetBookCode",
        bp."targetBookName",
        BOOL_OR(je.accounting_book_id = bp."opsBookId") AS "hasOps",
        BOOL_OR(je.accounting_book_id = bp."targetBookId") AS "hasTarget"
      FROM transactions t
      CROSS JOIN book_pairs bp
      INNER JOIN journal_entries je
        ON je.transaction_id = t.id
        AND je.organization_id = t.organization_id
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.is_final = true
        AND t.mirror_status NOT IN (
          CAST('NONE' AS "TransactionMirrorStatus"),
          CAST('FAILED' AS "TransactionMirrorStatus")
        )
        AND t.date >= ${from}::date
        AND t.date <= ${to}::date
      GROUP BY t.id, t.date, t.reference,
        bp."opsBookId", bp."opsBookCode", bp."targetBookId",
        bp."targetBookCode", bp."targetBookName"
      HAVING BOOL_OR(je.accounting_book_id = bp."opsBookId")
        IS DISTINCT FROM
        BOOL_OR(je.accounting_book_id = bp."targetBookId")
      ORDER BY t.date DESC, t.id, bp."targetBookCode"
      LIMIT ${take}
    `);

    let totalsMismatchItems: Array<{
      transactionId: string;
      date: string;
      reference: string | null;
      issue: string;
      opsBookId: string;
      opsBookCode: string;
      targetBookId: string;
      targetBookCode: string;
      nasDebitSum: string;
      ifrsDebitSum: string;
      opsDebitSum: string;
      targetDebitSum: string;
    }> = [];

    if (includeTotalsMismatch) {
      const parity = await this.prisma.$queryRaw<
        Array<{
          transactionId: string;
          date: Date;
          reference: string | null;
          opsBookId: string;
          opsBookCode: string;
          targetBookId: string;
          targetBookCode: string;
          opsDebitSum: unknown;
          targetDebitSum: unknown;
        }>
      >(Prisma.sql`
        WITH book_pairs AS (
          SELECT
            ops.id AS "opsBookId",
            ops.code AS "opsBookCode",
            target.id AS "targetBookId",
            target.code AS "targetBookCode"
          FROM accounting_books ops
          INNER JOIN accounting_books target
            ON target.organization_id = ops.organization_id
            AND target.status = CAST('ACTIVE' AS "AccountingBookStatus")
            AND target.is_default_ops = false
          WHERE ops.organization_id = ${organizationId}::uuid
            AND ops.status = CAST('ACTIVE' AS "AccountingBookStatus")
            AND ops.is_default_ops = true
        )
        SELECT
          t.id AS "transactionId",
          t.date AS "date",
          t.reference AS "reference",
          bp."opsBookId",
          bp."opsBookCode",
          bp."targetBookId",
          bp."targetBookCode",
          SUM(CASE WHEN je.accounting_book_id = bp."opsBookId" THEN je.debit ELSE 0 END) AS "opsDebitSum",
          SUM(CASE WHEN je.accounting_book_id = bp."targetBookId" THEN je.debit ELSE 0 END) AS "targetDebitSum"
        FROM transactions t
        CROSS JOIN book_pairs bp
        INNER JOIN journal_entries je
          ON je.transaction_id = t.id
          AND je.organization_id = t.organization_id
        WHERE t.organization_id = ${organizationId}::uuid
          AND t.is_final = true
          AND t.date >= ${from}::date
          AND t.date <= ${to}::date
        GROUP BY t.id, t.date, t.reference,
          bp."opsBookId", bp."opsBookCode", bp."targetBookId", bp."targetBookCode"
        HAVING BOOL_OR(je.accounting_book_id = bp."opsBookId")
          AND BOOL_OR(je.accounting_book_id = bp."targetBookId")
          AND ABS(
            SUM(CASE WHEN je.accounting_book_id = bp."opsBookId" THEN je.debit ELSE 0 END)
            - SUM(CASE WHEN je.accounting_book_id = bp."targetBookId" THEN je.debit ELSE 0 END)
          ) > CAST(0.0001 AS DECIMAL)
        ORDER BY t.date DESC, t.id, bp."targetBookCode"
        LIMIT ${take}
      `);
      totalsMismatchItems = parity.map((r) => ({
        transactionId: r.transactionId,
        date: r.date.toISOString().slice(0, 10),
        reference: r.reference,
        issue: "TOTAL_DEBIT_MISMATCH",
        opsBookId: r.opsBookId,
        opsBookCode: r.opsBookCode,
        targetBookId: r.targetBookId,
        targetBookCode: r.targetBookCode,
        opsDebitSum: String(r.opsDebitSum),
        targetDebitSum: String(r.targetDebitSum),
        // Compatibility aliases for existing export consumers.
        nasDebitSum: String(r.opsDebitSum),
        ifrsDebitSum: String(r.targetDebitSum),
      }));
    }

    const mirrorFailed = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        isFinal: true,
        mirrorStatus: "FAILED",
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        date: true,
        reference: true,
        mirrorErrorCode: true,
      },
      orderBy: { date: "desc" },
      take,
    });

    // IFRS-only posts (e.g. manual adjustments) keep mirrorStatus=NONE by design —
    // excluded from presence gaps above; surface a count for operators.
    const intentionalIfrsOnly = await this.prisma.$queryRaw<
      Array<{ count: unknown }>
    >(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM transactions t
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.is_final = true
        AND t.mirror_status = CAST('NONE' AS "TransactionMirrorStatus")
        AND t.date >= ${from}::date
        AND t.date <= ${to}::date
        AND EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.transaction_id = t.id
            AND je.organization_id = t.organization_id
            AND je.ledger_type = CAST('IFRS' AS "LedgerType")
        )
        AND NOT EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.transaction_id = t.id
            AND je.organization_id = t.organization_id
            AND je.ledger_type = CAST('NAS' AS "LedgerType")
        )
    `);
    const intentionalIfrsOnlyCount = Number(intentionalIfrsOnly[0]?.count ?? 0);
    const intentionalNonOpsByBook = await this.prisma.$queryRaw<
      Array<{
        accountingBookId: string;
        bookCode: string;
        bookName: string;
        transactionCount: unknown;
      }>
    >(Prisma.sql`
      SELECT
        b.id AS "accountingBookId",
        b.code AS "bookCode",
        COALESCE(b.name_en, b.name_ru, b.name_az, b.code) AS "bookName",
        COUNT(DISTINCT t.id)::bigint AS "transactionCount"
      FROM transactions t
      INNER JOIN journal_entries je
        ON je.transaction_id = t.id
        AND je.organization_id = t.organization_id
      INNER JOIN accounting_books b
        ON b.id = je.accounting_book_id
        AND b.organization_id = t.organization_id
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.is_final = true
        AND t.mirror_status = CAST('NONE' AS "TransactionMirrorStatus")
        AND t.date >= ${from}::date
        AND t.date <= ${to}::date
        AND b.is_default_ops = false
      GROUP BY b.id, b.code, b.name_en, b.name_ru, b.name_az
      ORDER BY b.code
    `);
    const intentionalNonOpsBookBreakdown = intentionalNonOpsByBook.map((row) => ({
      accountingBookId: row.accountingBookId,
      bookCode: row.bookCode,
      bookName: row.bookName,
      transactionCount: Number(row.transactionCount ?? 0),
    }));
    const intentionalNonOpsBookCount = intentionalNonOpsBookBreakdown.reduce(
      (sum, row) => sum + row.transactionCount,
      0,
    );

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      includeTotalsMismatch,
      presenceNote:
        "mirrorStatus NONE/FAILED excluded from default-ops vs ACTIVE non-ops book presence gaps; intentional NONE posts are counted per non-default accounting book",
      intentionalIfrsOnlyCount,
      intentionalNonOpsBookCount,
      intentionalNonOpsBookBreakdown,
      items: rows.map((r) => ({
        transactionId: r.transactionId,
        date: r.date.toISOString().slice(0, 10),
        reference: r.reference,
        opsBookId: r.opsBookId,
        opsBookCode: r.opsBookCode,
        targetBookId: r.targetBookId,
        targetBookCode: r.targetBookCode,
        targetBookName: r.targetBookName,
        hasOps: r.hasOps,
        hasTarget: r.hasTarget,
        // Compatibility aliases for the existing endpoint shape.
        hasNas: r.hasOps,
        hasIfrs: r.hasTarget,
        issue: r.hasOps && !r.hasTarget
          ? "MISSING_TARGET_BOOK"
          : "MISSING_OPS_BOOK",
      })),
      mirrorFailedItems: mirrorFailed.map((r) => ({
        transactionId: r.id,
        date: r.date.toISOString().slice(0, 10),
        reference: r.reference,
        issue: "MIRROR_STATUS_FAILED",
        mirrorErrorCode: r.mirrorErrorCode,
      })),
      totalsMismatchItems,
    };
  }
}
