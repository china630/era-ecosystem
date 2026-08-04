import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdvanceReportStatus,
  CashOrderKind,
  CashOrderStatus,
  Decimal,
  LedgerType,
  type PostingRole,
  type Prisma,
} from "@erafinance/database";
import { CashOrderRkoSubtype } from "./cash-order-subtype-codes";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { CurrencyConverterService } from "../fx/currency-converter.service";
import { enrichEmployeesWithMdm } from "../hr/employee-person.util";
import { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReportingService } from "../reporting/reporting.service";
import { decodeOrganizationTaxId } from "../security/pii-crypto.util";
import { lockOrgRowForUpdate } from "../common/db/lock-org-row";

type Tx = Prisma.TransactionClient;

export type AdvanceExpenseLineInput = {
  amount: number;
  description: string;
  expenseAccountCode?: string;
  vatRate?: number;
  receiptUrl?: string;
};

function d(v: Decimal | string | null | undefined): Decimal {
  if (v == null || v === "") return new Decimal(0);
  if (typeof v === "string") return new Decimal(v);
  return v;
}

@Injectable()
export class AdvanceReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
    private readonly reporting: ReportingService,
    private readonly fx: CurrencyConverterService,
    private readonly mdm: OrchestratorMdmClientService,
  ) {}

  async list(
    organizationId: string,
    filters?: {
      status?: AdvanceReportStatus;
      employeeId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, Math.trunc(filters?.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Math.trunc(filters?.pageSize ?? 25)));
    const where: Prisma.AdvanceReportWhereInput = { organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.reportDate = {};
      if (filters.dateFrom) {
        where.reportDate.gte = new Date(`${filters.dateFrom}T12:00:00.000Z`);
      }
      if (filters.dateTo) {
        where.reportDate.lte = new Date(`${filters.dateTo}T12:00:00.000Z`);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.advanceReport.findMany({
        where,
        orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          employee: { select: { id: true, globalPersonId: true, accountableAccountCode244: true } },
          cashOrder: { select: { id: true, orderNumber: true, amount: true, currency: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.advanceReport.count({ where }),
    ]);

    const enriched = await enrichEmployeesWithMdm(
      this.mdm,
      organizationId,
      items.map((r) => r.employee),
    );
    const byEmpId = new Map(enriched.map((e) => [e.id, e]));

    return {
      items: items.map((row) => ({
        ...row,
        employee: byEmpId.get(row.employeeId) ?? row.employee,
        lineCount: row._count.lines,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.advanceReport.findFirst({
      where: { id, organizationId },
      include: {
        employee: true,
        cashOrder: true,
        lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        transaction: { select: { id: true, reference: true } },
      },
    });
    if (!row) throw new NotFoundException("Advance report not found");
    const [employee] = await enrichEmployeesWithMdm(this.mdm, organizationId, [row.employee]);
    return { ...row, employee: employee ?? row.employee };
  }

  async createDraft(
    organizationId: string,
    dto: {
      employeeId: string;
      reportDate: string;
      expenseLines: AdvanceExpenseLineInput[];
      purpose?: string;
      currencyCode?: string;
      cashOrderId?: string;
    },
  ) {
    await this.assertEmployee244(organizationId, dto.employeeId);
    const currencyCode = (dto.currencyCode ?? "AZN").trim().toUpperCase();
    if (cashOrderIdProvided(dto.cashOrderId)) {
      await this.assertCashOrderLink(organizationId, dto.cashOrderId!, dto.employeeId);
    }
    const normalized = await this.normalizeLines(organizationId, dto.expenseLines);
    const total = normalized.reduce((s, l) => s.add(l.amount), new Decimal(0));
    if (total.lte(0)) {
      throw new BadRequestException("total expenses must be positive");
    }

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.advanceReport.create({
        data: {
          organizationId,
          employeeId: dto.employeeId,
          reportDate: new Date(`${dto.reportDate}T12:00:00.000Z`),
          currencyCode,
          cashOrderId: dto.cashOrderId ?? null,
          expenseLines: normalized.map((l) => ({
            amount: l.amount.toString(),
            description: l.description,
            expenseAccountCode: l.expenseAccountCode,
            vatRate: l.vatRate.toString(),
            receiptUrl: l.receiptUrl ?? null,
          })) as object,
          totalDeclared: total,
          purpose: dto.purpose?.trim() ?? "",
          status: AdvanceReportStatus.DRAFT,
        },
      });
      await this.replaceLinesTx(tx, organizationId, report.id, normalized);
      return tx.advanceReport.findUniqueOrThrow({
        where: { id: report.id },
        include: { lines: { orderBy: [{ sortOrder: "asc" }] } },
      });
    });
  }

  async updateDraft(
    organizationId: string,
    id: string,
    dto: {
      employeeId?: string;
      reportDate?: string;
      expenseLines?: AdvanceExpenseLineInput[];
      purpose?: string;
      currencyCode?: string;
      cashOrderId?: string | null;
    },
  ) {
    const existing = await this.prisma.advanceReport.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Advance report not found");
    if (existing.status !== AdvanceReportStatus.DRAFT) {
      throw new ConflictException("Only draft reports can be updated");
    }

    const employeeId = dto.employeeId ?? existing.employeeId;
    await this.assertEmployee244(organizationId, employeeId);

    const cashOrderId =
      dto.cashOrderId === undefined ? existing.cashOrderId : dto.cashOrderId;
    if (cashOrderId) {
      await this.assertCashOrderLink(organizationId, cashOrderId, employeeId);
    }

    let normalized: Awaited<ReturnType<AdvanceReportService["normalizeLines"]>> | undefined;
    let total = existing.totalDeclared;
    if (dto.expenseLines) {
      normalized = await this.normalizeLines(organizationId, dto.expenseLines);
      total = normalized.reduce((s, l) => s.add(l.amount), new Decimal(0));
      if (total.lte(0)) {
        throw new BadRequestException("total expenses must be positive");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.advanceReport.update({
        where: { id },
        data: {
          ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
          ...(dto.reportDate !== undefined && {
            reportDate: new Date(`${dto.reportDate}T12:00:00.000Z`),
          }),
          ...(dto.currencyCode !== undefined && {
            currencyCode: dto.currencyCode.trim().toUpperCase(),
          }),
          ...(dto.cashOrderId !== undefined && { cashOrderId: dto.cashOrderId }),
          ...(dto.purpose !== undefined && { purpose: dto.purpose.trim() }),
          ...(normalized && {
            totalDeclared: total,
            expenseLines: normalized.map((l) => ({
              amount: l.amount.toString(),
              description: l.description,
              expenseAccountCode: l.expenseAccountCode,
              vatRate: l.vatRate.toString(),
              receiptUrl: l.receiptUrl ?? null,
            })) as object,
          }),
        },
      });
      if (normalized) {
        await this.replaceLinesTx(tx, organizationId, id, normalized);
      }
      return tx.advanceReport.findUniqueOrThrow({
        where: { id },
        include: {
          lines: { orderBy: [{ sortOrder: "asc" }] },
          employee: true,
          cashOrder: true,
        },
      });
    });
  }

  async post(organizationId: string, reportId: string) {
    const rep = await this.prisma.advanceReport.findFirst({
      where: { id: reportId, organizationId },
      include: {
        employee: true,
        lines: { orderBy: [{ sortOrder: "asc" }] },
      },
    });
    if (!rep) throw new NotFoundException("Advance report not found");
    if (rep.status !== AdvanceReportStatus.DRAFT) {
      throw new ConflictException("Already posted");
    }

    const acc244 = rep.employee.accountableAccountCode244?.trim();
    if (!acc244) {
      throw new BadRequestException("Employee 244 account missing");
    }

    const lines = rep.lines.length > 0 ? rep.lines : this.legacyLinesFromJson(rep.expenseLines);
    if (lines.length === 0) {
      throw new BadRequestException("Advance report has no expense lines");
    }

    const currency = rep.currencyCode.trim().toUpperCase();
    const reportDate = rep.reportDate;

    let totalAzn = new Decimal(0);
    const journalLines: Array<{ accountCode: string; debit: string; credit: string }> = [];

    for (const line of lines) {
      const amountDoc = d(line.amount);
      let amountAzn: Decimal;
      if (currency === "AZN" || currency === "AZM") {
        amountAzn = amountDoc;
      } else {
        try {
          amountAzn = await this.fx.convert(amountDoc, currency, "AZN", reportDate);
        } catch {
          throw new BadRequestException(
            `FX rate unavailable for ${currency} on ${reportDate.toISOString().slice(0, 10)} — post in AZN or configure CBAR rates`,
          );
        }
      }
      totalAzn = totalAzn.add(amountAzn);
      const expenseCode = await this.resolveExpenseAccountCode(
        organizationId,
        line.expenseAccountCode,
      );
      journalLines.push({
        accountCode: expenseCode,
        debit: amountAzn.toFixed(4),
        credit: "0",
      });
    }

    journalLines.push({
      accountCode: acc244,
      debit: "0",
      credit: totalAzn.toFixed(4),
    });

    const balance244 = await this.getAccountableBalance244(organizationId, acc244);
    if (balance244.lt(totalAzn)) {
      throw new BadRequestException(
        `244 balance ${balance244.toFixed(2)} AZN is less than report total ${totalAzn.toFixed(2)} AZN`,
      );
    }

    if (rep.cashOrderId) {
      await this.assertCashOrderLink(organizationId, rep.cashOrderId, rep.employeeId);
    }

    return this.prisma.$transaction(async (tx) => {
      // SEC-FIN-04: lock before journal
      const locked = await lockOrgRowForUpdate(
        tx,
        "advance_reports",
        rep.id,
        organizationId,
      );
      if (!locked || locked.status !== AdvanceReportStatus.DRAFT) {
        throw new ConflictException("Already posted");
      }
      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: reportDate,
        reference: `AVANS-${rep.id.slice(0, 8)}`,
        description: rep.purpose || "Avans hesabatı",
        isFinal: true,
        lines: journalLines,
      });
      const claimed = await tx.advanceReport.updateMany({
        where: {
          id: rep.id,
          organizationId,
          status: AdvanceReportStatus.DRAFT,
        },
        data: {
          status: AdvanceReportStatus.POSTED,
          transactionId,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("Already posted");
      }
      return tx.advanceReport.findUniqueOrThrow({
        where: { id: rep.id },
        include: { lines: true, transaction: { select: { id: true, reference: true } } },
      });
    });
  }

  async getPrintHtml(organizationId: string, reportId: string): Promise<string> {
    const rep = await this.getOne(organizationId, reportId);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { name: true, taxIdCipher: true },
    });
    const empName =
      (rep.employee as { displayName?: string }).displayName?.trim() ||
      `${(rep.employee as { lastName?: string }).lastName ?? ""} ${(rep.employee as { firstName?: string }).firstName ?? ""}`.trim() ||
      "—";
    const lines =
      rep.lines.length > 0
        ? rep.lines
        : this.legacyLinesFromJson(rep.expenseLines).map((l, i) => ({
            ...l,
            sortOrder: i,
          }));

    const lineRows = lines
      .map(
        (l, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(l.description)}</td><td>${escapeHtml(l.expenseAccountCode)}</td><td style="text-align:right">${d(l.amount).toFixed(2)}</td><td style="text-align:right">${d(l.vatRate).toFixed(0)}%</td></tr>`,
      )
      .join("");

    const cashOrderRow = rep.cashOrder
      ? `<tr><td class="lbl">MXO (KXO)</td><td>${escapeHtml(rep.cashOrder.orderNumber)} — ${rep.cashOrder.amount.toFixed(2)} ${escapeHtml(rep.cashOrder.currency)}</td></tr>`
      : "";

    return `<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="utf-8"/>
  <title>Avans hesabatı — ${rep.id.slice(0, 8)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: "Segoe UI", system-ui, sans-serif; font-size: 11pt; max-width: 180mm; margin: 0 auto; padding: 10mm; }
    h1 { font-size: 14pt; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    td, th { border: 1px solid #222; padding: 6px 8px; }
    td.lbl { width: 32%; font-weight: 600; background: #f8f8f8; }
    th { background: #eee; font-size: 10pt; }
  </style>
</head>
<body>
  <h1>Avans hesabatı</h1>
  <p><strong>Tarix:</strong> ${rep.reportDate.toISOString().slice(0, 10)} &nbsp;·&nbsp; <strong>Valyuta:</strong> ${escapeHtml(rep.currencyCode)}</p>
  <p><strong>Təşkilat:</strong> ${escapeHtml(org?.name ?? "")} &nbsp;·&nbsp; VÖEN: ${escapeHtml(decodeOrganizationTaxId(org ?? {}) || "—")}</p>
  <table>
    <tr><td class="lbl">Podotçotnik</td><td>${escapeHtml(empName)}</td></tr>
    <tr><td class="lbl">Məqsəd</td><td>${escapeHtml(rep.purpose || "—")}</td></tr>
    <tr><td class="lbl">Cəmi</td><td>${rep.totalDeclared.toFixed(2)} ${escapeHtml(rep.currencyCode)}</td></tr>
    <tr><td class="lbl">Status</td><td>${rep.status}</td></tr>
    ${cashOrderRow}
  </table>
  <h2 style="font-size:12pt;margin-top:16px">Xərc sətirləri</h2>
  <table>
    <thead><tr><th>№</th><th>Təsvir</th><th>Hesab</th><th>Məbləğ</th><th>ƏDV</th></tr></thead>
    <tbody>${lineRows || "<tr><td colspan=\"5\">—</td></tr>"}</tbody>
  </table>
  <p style="margin-top:24px;font-size:10pt">İmza: ______________________ &nbsp; M.Ə.</p>
  <script>window.onload=function(){window.focus();};</script>
</body>
</html>`;
  }

  /** @deprecated Use AdvanceReportService — kept for cash page modal compatibility. */
  async createAdvanceReportDraft(
    organizationId: string,
    dto: {
      employeeId: string;
      reportDate: string;
      expenseLines: Array<{ amount: number; description: string }>;
      purpose?: string;
    },
  ) {
    return this.createDraft(organizationId, {
      ...dto,
      expenseLines: dto.expenseLines.map((l) => ({
        amount: l.amount,
        description: l.description,
      })),
    });
  }

  /** @deprecated Use AdvanceReportService.post */
  async postAdvanceReport(organizationId: string, reportId: string) {
    return this.post(organizationId, reportId);
  }

  private async normalizeLines(organizationId: string, lines: AdvanceExpenseLineInput[]) {
    if (!lines.length) {
      throw new BadRequestException("At least one expense line required");
    }
    const defaultExpense = await this.posting.resolveAccountCode(
      organizationId,
      "MISC_OPERATING_EXPENSE",
    );
    const out: Array<{
      amount: Decimal;
      description: string;
      expenseAccountCode: string;
      vatRate: Decimal;
      receiptUrl?: string;
    }> = [];

    for (const row of lines) {
      const amt = new Decimal(row.amount);
      if (amt.lte(0)) continue;
      const desc = row.description?.trim();
      if (!desc) {
        throw new BadRequestException("Each line requires description");
      }
      const expenseAccountCode = (row.expenseAccountCode?.trim() || defaultExpense).slice(0, 32);
      const vatRate = new Decimal(row.vatRate ?? 0);
      out.push({
        amount: amt,
        description: desc,
        expenseAccountCode,
        vatRate,
        receiptUrl: row.receiptUrl?.trim() || undefined,
      });
    }
    if (!out.length) {
      throw new BadRequestException("At least one positive expense line required");
    }
    return out;
  }

  private async replaceLinesTx(
    tx: Tx,
    organizationId: string,
    advanceReportId: string,
    lines: Array<{
      amount: Decimal;
      description: string;
      expenseAccountCode: string;
      vatRate: Decimal;
      receiptUrl?: string;
    }>,
  ) {
    await tx.advanceReportLine.deleteMany({ where: { advanceReportId, organizationId } });
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      await tx.advanceReportLine.create({
        data: {
          organizationId,
          advanceReportId,
          sortOrder: i,
          amount: l.amount,
          description: l.description,
          expenseAccountCode: l.expenseAccountCode,
          vatRate: l.vatRate,
          receiptUrl: l.receiptUrl ?? null,
        },
      });
    }
  }

  private async assertEmployee244(organizationId: string, employeeId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
    });
    if (!emp?.accountableAccountCode244?.trim()) {
      throw new BadRequestException("Employee accountable 244 account not set");
    }
  }

  private async assertCashOrderLink(
    organizationId: string,
    cashOrderId: string,
    employeeId: string,
  ) {
    const order = await this.prisma.cashOrder.findFirst({
      where: { id: cashOrderId, organizationId },
    });
    if (!order) throw new BadRequestException("Linked cash order not found");
    if (order.kind !== CashOrderKind.KXO) {
      throw new BadRequestException("Linked order must be KXO (MXO issue)");
    }
    if (order.rkoSubtype !== CashOrderRkoSubtype.ACCOUNTABLE_ISSUE) {
      throw new BadRequestException("Linked order must be ACCOUNTABLE_ISSUE subtype");
    }
    if (order.status !== CashOrderStatus.POSTED) {
      throw new BadRequestException("Linked cash order must be posted");
    }
    if (order.employeeId !== employeeId) {
      throw new BadRequestException("Linked cash order employee mismatch");
    }
  }

  private async resolveExpenseAccountCode(
    organizationId: string,
    codeOrRole: string,
  ): Promise<string> {
    const trimmed = codeOrRole.trim();
    if (/^\d/.test(trimmed)) return trimmed;
    return this.posting.resolveAccountCode(
      organizationId,
      trimmed as PostingRole,
    );
  }

  private async getAccountableBalance244(
    organizationId: string,
    accountCode244: string,
  ): Promise<Decimal> {
    const yearStart = `${new Date().getUTCFullYear()}-01-01`;
    const today = new Date().toISOString().slice(0, 10);
    const tb = await this.reporting.trialBalance(
      organizationId,
      yearStart,
      today,
      LedgerType.NAS,
    );
    type TbRow = { accountCode: string; closingDebit: unknown; closingCredit: unknown };
    const row = (tb.rows as TbRow[]).find((r) => r.accountCode === accountCode244);
    if (!row) return new Decimal(0);
    return d(row.closingDebit).sub(d(row.closingCredit));
  }

  private legacyLinesFromJson(expenseLines: unknown): Array<{
    amount: Decimal;
    description: string;
    expenseAccountCode: string;
    vatRate: Decimal;
    receiptUrl?: string | null;
  }> {
    if (!Array.isArray(expenseLines)) return [];
    return expenseLines.map((raw) => {
      const o = raw as Record<string, unknown>;
      return {
        amount: d(String(o.amount ?? "0")),
        description: String(o.description ?? ""),
        expenseAccountCode: String(o.expenseAccountCode ?? "731"),
        vatRate: d(String(o.vatRate ?? "0")),
        receiptUrl: o.receiptUrl ? String(o.receiptUrl) : null,
      };
    });
  }
}

function cashOrderIdProvided(id: string | undefined | null): id is string {
  return typeof id === "string" && id.trim().length > 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
