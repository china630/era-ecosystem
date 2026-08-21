import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FixedAssetLifecycleEventType,
  InvoicePaymentKind,
  InvoiceStatus,
  LedgerType,
  Prisma,
  TransactionKind,
  UserRole,
  type PostingRole,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { decodeOrganizationTaxId, decryptText } from "../security/pii-crypto.util";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import {
  deriveInvoicePaymentState,
} from "../invoices/invoice-payment-state.util";
import { AccountingService } from "./accounting.service";
import type { CreateManualAdjustmentDto } from "./dto/create-manual-adjustment.dto";
import type { ReverseManualAdjustmentDto } from "./dto/reverse-manual-adjustment.dto";
import {
  MANUAL_ADJUSTMENT_REASON_MIN,
  MANUAL_ADJUSTMENT_TEMPLATES_REQUIRING_COUNTERPARTY,
  type ManualAdjustmentTemplate,
} from "./manual-adjustment.constants";
import {
  renderManualAdjustmentVoucherPdf,
} from "./manual-adjustment-voucher-pdf.render";
import { PostingAccountResolver } from "./posting/posting-account-resolver.service";
import {
  getClosedPeriodKeys,
  monthKeyUtc,
} from "../reporting/reporting-period.util";

const Decimal = Prisma.Decimal;

@Injectable()
export class ManualAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  async create(
    organizationId: string,
    dto: CreateManualAdjustmentDto,
    actingUserRole: UserRole,
  ): Promise<{ transactionId: string; reference: string }> {
    if (actingUserRole === UserRole.USER) {
      throw new ForbiddenException(
        "Роль USER не может проводить ручные операции в журнале",
      );
    }
    const reason = dto.reason.trim();
    if (reason.length < MANUAL_ADJUSTMENT_REASON_MIN) {
      throw new BadRequestException(
        `reason must be at least ${MANUAL_ADJUSTMENT_REASON_MIN} characters`,
      );
    }

    let date: Date;
    try {
      date = parseIsoDateOnly(dto.date);
    } catch {
      throw new BadRequestException("Invalid date (expected YYYY-MM-DD)");
    }

    if (dto.counterpartyId) {
      const cp = await this.prisma.counterparty.findFirst({
        where: { id: dto.counterpartyId, organizationId },
        select: { id: true },
      });
      if (!cp) throw new NotFoundException("Counterparty not found");
    }
    if (dto.basisInvoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: dto.basisInvoiceId, organizationId },
        select: { id: true },
      });
      if (!inv) throw new NotFoundException("Invoice not found");
    }
    if (dto.basisFixedAssetId) {
      const fa = await this.prisma.fixedAsset.findFirst({
        where: { id: dto.basisFixedAssetId, organizationId },
        select: { id: true },
      });
      if (!fa) throw new NotFoundException("Fixed asset not found");
    }

    const template = dto.template ?? "FREEFORM";
    this.assertCounterpartyForTemplate(template, dto.counterpartyId);

    const dayKey = dto.date.replace(/-/g, "");
    const reference = `ADJ-${dayKey}-${crypto.randomUUID().slice(0, 8)}`;

    const { transactionId } = await this.accounting.postTransaction({
      organizationId,
      date,
      reference,
      description: reason.slice(0, 200),
      reason,
      kind: TransactionKind.MANUAL_ADJUSTMENT,
      manualTemplate: template,
      isFinal: true,
      actingUserRole,
      counterpartyId: dto.counterpartyId ?? null,
      departmentId: dto.departmentId ?? null,
      basisInvoiceId: dto.basisInvoiceId ?? null,
      basisFixedAssetId: dto.basisFixedAssetId ?? null,
      lines: dto.lines.map((l) => ({
        accountCode: l.accountCode.trim(),
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
      })),
    });

    return { transactionId, reference };
  }

  async preview(
    organizationId: string,
    dto: CreateManualAdjustmentDto,
  ): Promise<{
    lines: Array<{ accountCode: string; debit: string; credit: string }>;
    periodClosed: boolean;
    periodKey: string | null;
  }> {
    const reason = dto.reason.trim();
    if (reason.length < MANUAL_ADJUSTMENT_REASON_MIN) {
      throw new BadRequestException(
        `reason must be at least ${MANUAL_ADJUSTMENT_REASON_MIN} characters`,
      );
    }

    let date: Date;
    try {
      date = parseIsoDateOnly(dto.date);
    } catch {
      throw new BadRequestException("Invalid date (expected YYYY-MM-DD)");
    }

    await this.validateBasisRefs(organizationId, dto);
    const template = dto.template ?? "FREEFORM";
    this.assertCounterpartyForTemplate(template, dto.counterpartyId);

    this.accounting.validateBalance(
      dto.lines.map((l) => ({
        accountCode: l.accountCode.trim(),
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
      })),
    );

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(org?.settings);
    const periodKey = monthKeyUtc(date);
    const periodClosed = closed.includes(periodKey);

    return {
      lines: dto.lines.map((l) => ({
        accountCode: l.accountCode.trim(),
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
      })),
      periodClosed,
      periodKey,
    };
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.transaction.findFirst({
      where: {
        id,
        organizationId,
        kind: TransactionKind.MANUAL_ADJUSTMENT,
      },
      include: {
        counterparty: { select: { nameCipher: true } },
        journalEntries: {
          where: { ledgerType: LedgerType.NAS },
          include: { account: { select: { code: true, nameRu: true, nameAz: true, nameEn: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!row) throw new NotFoundException("Manual adjustment not found");

    const reversedBy = await this.prisma.transaction.findFirst({
      where: { organizationId, reversesTransactionId: id },
      select: { id: true },
    });

    let basisLabel: string | null = null;
    if (row.basisInvoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: row.basisInvoiceId, organizationId },
        select: { number: true },
      });
      basisLabel = inv?.number ?? row.basisInvoiceId;
    } else if (row.basisFixedAssetId) {
      const fa = await this.prisma.fixedAsset.findFirst({
        where: { id: row.basisFixedAssetId, organizationId },
        select: { inventoryNumber: true },
      });
      basisLabel = fa ? `FA ${fa.inventoryNumber}` : row.basisFixedAssetId;
    }

    let amount = new Decimal(0);
    for (const e of row.journalEntries) {
      amount = amount.add(e.debit);
    }

    return {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      reference: row.reference,
      reason: row.reason,
      template: row.manualTemplate,
      counterpartyId: row.counterpartyId,
      counterpartyName: row.counterparty?.nameCipher
        ? decryptText(row.counterparty.nameCipher)
        : null,
      departmentId: row.departmentId,
      basisInvoiceId: row.basisInvoiceId,
      basisFixedAssetId: row.basisFixedAssetId,
      basisLabel,
      reversedById: reversedBy?.id ?? null,
      amount: amount.toFixed(2),
      lines: row.journalEntries.map((e) => ({
        accountCode: e.account.code,
        accountName: e.account.nameAz || e.account.nameRu || e.account.nameEn || e.account.code,
        debit: e.debit.toFixed(4),
        credit: e.credit.toFixed(4),
      })),
    };
  }

  async reverse(
    organizationId: string,
    id: string,
    dto: ReverseManualAdjustmentDto,
    actingUserRole: UserRole,
  ): Promise<{ transactionId: string; reference: string }> {
    if (actingUserRole === UserRole.USER) {
      throw new ForbiddenException(
        "Роль USER не может проводить ручные операции в журнале",
      );
    }
    const reason = dto.reason.trim();
    if (reason.length < MANUAL_ADJUSTMENT_REASON_MIN) {
      throw new BadRequestException(
        `reason must be at least ${MANUAL_ADJUSTMENT_REASON_MIN} characters`,
      );
    }

    let revDate: Date;
    try {
      revDate = parseIsoDateOnly(dto.date);
    } catch {
      throw new BadRequestException("Invalid date (expected YYYY-MM-DD)");
    }

    const original = await this.prisma.transaction.findFirst({
      where: { id, organizationId, kind: TransactionKind.MANUAL_ADJUSTMENT },
      include: {
        journalEntries: {
          where: { ledgerType: LedgerType.NAS },
          include: { account: { select: { code: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!original) throw new NotFoundException("Manual adjustment not found");

    const existingReverse = await this.prisma.transaction.findFirst({
      where: { organizationId, reversesTransactionId: id },
      select: { id: true },
    });
    if (existingReverse) {
      throw new BadRequestException("This adjustment was already reversed");
    }

    if (original.reversesTransactionId) {
      throw new BadRequestException("Cannot reverse a reversal voucher");
    }

    const faDonationAcq = await this.prisma.fixedAssetLifecycleEvent.findFirst({
      where: {
        organizationId,
        transactionId: id,
        eventType: FixedAssetLifecycleEventType.ACQUISITION,
      },
      select: { payloadJson: true },
    });
    const payload = faDonationAcq?.payloadJson as { creditSource?: string } | null;
    if (payload?.creditSource === "DONATION") {
      throw new BadRequestException(
        "Fixed asset donation acquisition cannot be reversed here; use lifecycle dispose",
      );
    }

    const mirroredLines = original.journalEntries.map((e) => ({
      accountCode: e.account.code,
      debit: e.credit.toString(),
      credit: e.debit.toString(),
    }));

    const creditAdjPayment = await this.prisma.invoicePayment.findFirst({
      where: {
        organizationId,
        transactionId: id,
        kind: InvoicePaymentKind.CREDIT_ADJUSTMENT,
      },
      select: { id: true, invoiceId: true, amount: true },
    });

    const dayKey = dto.date.replace(/-/g, "");
    const reference = `ADJ-REV-${dayKey}-${crypto.randomUUID().slice(0, 8)}`;

    const { transactionId } = await this.prisma.$transaction(async (tx) => {
      const { transactionId: revTxId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: revDate,
        reference,
        description: reason.slice(0, 200),
        reason,
        kind: TransactionKind.MANUAL_ADJUSTMENT,
        isFinal: true,
        counterpartyId: original.counterpartyId,
        departmentId: original.departmentId,
        basisInvoiceId: original.basisInvoiceId,
        basisFixedAssetId: original.basisFixedAssetId,
        reversesTransactionId: id,
        lines: mirroredLines,
      });

      if (creditAdjPayment) {
        const payAmount = new Decimal(creditAdjPayment.amount);
        await tx.invoicePayment.create({
          data: {
            organizationId,
            invoiceId: creditAdjPayment.invoiceId,
            amount: payAmount,
            date: revDate,
            kind: InvoicePaymentKind.CREDIT_ADJUSTMENT_REVERSAL,
            transactionId: revTxId,
          },
        });

        const inv = await tx.invoice.findFirstOrThrow({
          where: { id: creditAdjPayment.invoiceId, organizationId },
          select: { totalAmount: true, paidAmount: true, status: true },
        });
        const newPaid = (inv.paidAmount ?? new Decimal(0)).sub(payAmount);
        if (newPaid.lt(0)) {
          throw new BadRequestException("paidAmount would become negative");
        }
        const { nextStatus, paymentReceived } = deriveInvoicePaymentState(
          inv.totalAmount,
          newPaid,
          inv.status,
        );
        await tx.invoice.update({
          where: { id: creditAdjPayment.invoiceId },
          data: {
            paidAmount: newPaid,
            status: nextStatus,
            paymentReceived,
          },
        });
      }

      return { transactionId: revTxId };
    });

    return { transactionId, reference };
  }

  async renderPdf(organizationId: string, id: string): Promise<Buffer> {
    const detail = await this.getOne(organizationId, id);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, taxIdCipher: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    return renderManualAdjustmentVoucherPdf({
      organizationName: org.name ?? "—",
      organizationTaxId: decodeOrganizationTaxId(org) || "—",
      date: detail.date,
      reference: detail.reference ?? detail.id.slice(0, 8),
      reason: detail.reason ?? "",
      basisLabel: detail.basisLabel,
      counterpartyName: detail.counterpartyName,
      lines: detail.lines.map((l) => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: l.debit,
        credit: l.credit,
      })),
      disclaimerAz:
        "Bu sənəd kredit qaiməsi və ya e-qaimə deyil; yalnız daxili mühasibat arayışıdır.",
      disclaimerRu:
        "Документ не является кредит-нотой и не e-qaimə; только внутренняя бухгалтерская справка.",
    });
  }

  async list(
    organizationId: string,
    query: {
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    items: Array<{
      id: string;
      date: string;
      reference: string | null;
      reason: string | null;
      template: string | null;
      counterpartyName: string | null;
      basisLabel: string | null;
      basisInvoiceId: string | null;
      basisFixedAssetId: string | null;
      reversedById: string | null;
      canReverse: boolean;
      amount: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const where: Prisma.TransactionWhereInput = {
      organizationId,
      kind: TransactionKind.MANUAL_ADJUSTMENT,
    };
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        try {
          where.date.gte = parseIsoDateOnly(query.dateFrom);
        } catch {
          throw new BadRequestException("Invalid dateFrom (expected YYYY-MM-DD)");
        }
      }
      if (query.dateTo) {
        try {
          where.date.lte = parseIsoDateOnly(query.dateTo);
        } catch {
          throw new BadRequestException("Invalid dateTo (expected YYYY-MM-DD)");
        }
      }
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          counterparty: { select: { nameCipher: true } },
          journalEntries: {
            where: { ledgerType: LedgerType.NAS },
            select: { debit: true },
          },
        },
      }),
    ]);

    const invoiceIds = [
      ...new Set(rows.map((r) => r.basisInvoiceId).filter((id): id is string => !!id)),
    ];
    const faIds = [
      ...new Set(rows.map((r) => r.basisFixedAssetId).filter((id): id is string => !!id)),
    ];
    const [basisInvoices, basisAssets] = await Promise.all([
      invoiceIds.length
        ? this.prisma.invoice.findMany({
            where: { organizationId, id: { in: invoiceIds } },
            select: { id: true, number: true },
          })
        : [],
      faIds.length
        ? this.prisma.fixedAsset.findMany({
            where: { organizationId, id: { in: faIds } },
            select: { id: true, inventoryNumber: true },
          })
        : [],
    ]);
    const invoiceById = new Map(basisInvoices.map((i) => [i.id, i.number]));
    const assetById = new Map(basisAssets.map((a) => [a.id, a.inventoryNumber]));

    const rowIds = rows.map((r) => r.id);
    const reverseRows = rowIds.length
      ? await this.prisma.transaction.findMany({
          where: { organizationId, reversesTransactionId: { in: rowIds } },
          select: { id: true, reversesTransactionId: true },
        })
      : [];
    const reversedByMap = new Map(
      reverseRows.map((r) => [r.reversesTransactionId!, r.id]),
    );

    return {
      items: rows.map((r) => {
        let amount = new Decimal(0);
        for (const e of r.journalEntries) {
          amount = amount.add(e.debit);
        }
        let basisLabel: string | null = null;
        if (r.basisInvoiceId) {
          basisLabel = invoiceById.get(r.basisInvoiceId) ?? r.basisInvoiceId;
        } else if (r.basisFixedAssetId) {
          const invNo = assetById.get(r.basisFixedAssetId);
          basisLabel = invNo ? `FA ${invNo}` : r.basisFixedAssetId;
        }
        return {
          id: r.id,
          date: r.date.toISOString().slice(0, 10),
          reference: r.reference,
          reason: r.reason,
          template: r.manualTemplate,
          counterpartyName: r.counterparty?.nameCipher
            ? decryptText(r.counterparty.nameCipher)
            : null,
          basisLabel,
          basisInvoiceId: r.basisInvoiceId,
          basisFixedAssetId: r.basisFixedAssetId,
          reversedById: reversedByMap.get(r.id) ?? null,
          canReverse: !reversedByMap.has(r.id) && !r.reversesTransactionId,
          amount: amount.toFixed(2),
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async suggestLines(
    organizationId: string,
    template: ManualAdjustmentTemplate,
  ): Promise<{ lines: Array<{ accountCode: string; debitHint: "debit" | "credit" }> }> {
    const pair = await this.templateAccountPair(organizationId, template);
    if (!pair) {
      return { lines: [] };
    }
    return {
      lines: [
        { accountCode: pair.debit, debitHint: "debit" },
        { accountCode: pair.credit, debitHint: "credit" },
      ],
    };
  }

  private async templateAccountPair(
    organizationId: string,
    template: ManualAdjustmentTemplate,
  ): Promise<{ debit: string; credit: string } | null> {
    const role = (r: PostingRole) => this.posting.resolveAccountCode(organizationId, r);
    switch (template) {
      case "AR_OVERCOLLECTION_REFUND":
        return {
          debit: await role("TRADE_RECEIVABLE"),
          credit: await role("CASH_AZN"),
        };
      case "AR_WRITEOFF":
        return {
          debit: await role("MISC_OPERATING_EXPENSE"),
          credit: await role("TRADE_RECEIVABLE"),
        };
      case "AP_WRITEOFF":
        return {
          debit: await role("SUPPLIER_PAYABLE"),
          credit: await role("MISC_OPERATING_EXPENSE"),
        };
      case "DONATION_IN_KIND":
        return {
          debit: await role("FIXED_ASSET_COST"),
          credit: await role("DONATION_REVENUE"),
        };
      default:
        return null;
    }
  }

  private assertCounterpartyForTemplate(
    template: ManualAdjustmentTemplate | string,
    counterpartyId?: string | null,
  ): void {
    if (
      MANUAL_ADJUSTMENT_TEMPLATES_REQUIRING_COUNTERPARTY.includes(
        template as (typeof MANUAL_ADJUSTMENT_TEMPLATES_REQUIRING_COUNTERPARTY)[number],
      ) &&
      !counterpartyId?.trim()
    ) {
      throw new BadRequestException(
        "counterpartyId is required for this template",
      );
    }
  }

  private async validateBasisRefs(
    organizationId: string,
    dto: CreateManualAdjustmentDto,
  ): Promise<void> {
    if (dto.counterpartyId) {
      const cp = await this.prisma.counterparty.findFirst({
        where: { id: dto.counterpartyId, organizationId },
        select: { id: true },
      });
      if (!cp) throw new NotFoundException("Counterparty not found");
    }
    if (dto.basisInvoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: dto.basisInvoiceId, organizationId },
        select: { id: true },
      });
      if (!inv) throw new NotFoundException("Invoice not found");
    }
    if (dto.basisFixedAssetId) {
      const fa = await this.prisma.fixedAsset.findFirst({
        where: { id: dto.basisFixedAssetId, organizationId },
        select: { id: true },
      });
      if (!fa) throw new NotFoundException("Fixed asset not found");
    }
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
        select: { id: true },
      });
      if (!dept) throw new NotFoundException("Department not found");
    }
  }
}
