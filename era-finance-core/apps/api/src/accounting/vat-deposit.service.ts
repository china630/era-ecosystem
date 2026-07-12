import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BankAccountType,
  BankStatementLineType,
  LedgerType,
  Prisma,
  VatDepositLedgerKind,
} from "@erafinance/database";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import { PrismaService } from "../prisma/prisma.service";
import { PostingAccountResolver } from "./posting/posting-account-resolver.service";
import { PostingJournalBuilder } from "./posting/posting-journal-builder.service";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

function d(v: Prisma.Decimal | null | undefined): Decimal {
  return v ?? new Decimal(0);
}

@Injectable()
export class VatDepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: PostingAccountResolver,
    private readonly postingJournal: PostingJournalBuilder,
  ) {}

  async getBalance(organizationId: string) {
    const accountCode = await this.posting.resolveVatDepositAccountCode(organizationId);
    const acc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code: accountCode,
        deletedAt: null,
      },
      select: { id: true, code: true, nameAz: true },
    });
    if (!acc) {
      throw new NotFoundException(`NAS account ${accountCode} is not provisioned`);
    }

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        accountId: acc.id,
      },
      select: { debit: true, credit: true },
    });

    let balance = new Decimal(0);
    for (const row of entries) {
      balance = balance.add(d(row.debit).sub(d(row.credit)));
    }

    const depositBank = await this.prisma.organizationBankAccount.findFirst({
      where: {
        organizationId,
        accountType: BankAccountType.VAT_DEPOSIT,
        isArchived: false,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        iban: true,
        bankName: true,
        ledgerAccountCode: true,
      },
    });

    return {
      accountCode: acc.code,
      accountNameAz: acc.nameAz,
      balance: balance.toFixed(4),
      currency: "AZN",
      linkedBankAccount: depositBank,
    };
  }

  async listMovements(
    organizationId: string,
    opts?: { dateFrom?: string; dateTo?: string },
  ) {
    const where: Prisma.VatDepositLedgerEntryWhereInput = { organizationId };
    if (opts?.dateFrom?.trim() || opts?.dateTo?.trim()) {
      where.createdAt = {};
      if (opts.dateFrom?.trim()) {
        where.createdAt.gte = parseIsoDateOnly(opts.dateFrom);
      }
      if (opts.dateTo?.trim()) {
        const to = parseIsoDateOnly(opts.dateTo);
        to.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const rows = await this.prisma.vatDepositLedgerEntry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        transaction: { select: { id: true, reference: true, description: true, date: true } },
        bankStatementLine: {
          select: { id: true, amount: true, type: true, description: true, valueDate: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      amount: row.amount.toFixed(4),
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      transaction: row.transaction,
      bankStatementLine: row.bankStatementLine,
    }));
  }

  private async resolveSourceBankAccountCode(
    organizationId: string,
    tx: Prisma.TransactionClient,
    params: { bankAccountId?: string | null; debitAccountCode?: string | null },
  ): Promise<string> {
    if (params.debitAccountCode?.trim()) {
      return params.debitAccountCode.trim();
    }
    if (params.bankAccountId?.trim()) {
      const row = await tx.organizationBankAccount.findFirst({
        where: {
          id: params.bankAccountId.trim(),
          organizationId,
          isArchived: false,
          deletedAt: null,
        },
        select: { ledgerAccountCode: true },
      });
      if (!row?.ledgerAccountCode?.trim()) {
        throw new NotFoundException("Source bank account not found");
      }
      return row.ledgerAccountCode.trim();
    }
    return this.posting.resolveAccountCode(organizationId, "MAIN_BANK", tx);
  }

  async routeIncomingVatPortion(
    tx: Prisma.TransactionClient,
    organizationId: string,
    params: {
      paymentAmount: Decimal | number | string;
      vatPortion: Decimal | number | string;
      bankAccountId?: string | null;
      counterpartyId?: string | null;
      debitAccountCode?: string | null;
      note?: string | null;
      paymentDate?: Date;
      reference?: string | null;
    },
  ) {
    const paymentAmount = new Decimal(params.paymentAmount);
    const vatPortion = new Decimal(params.vatPortion);
    if (paymentAmount.lte(0)) {
      throw new BadRequestException("paymentAmount must be positive");
    }
    if (vatPortion.lte(0)) {
      throw new BadRequestException("vatPortion must be positive");
    }
    if (vatPortion.gt(paymentAmount)) {
      throw new BadRequestException("vatPortion cannot exceed paymentAmount");
    }

    const depositCode = await this.posting.resolveVatDepositAccountCode(
      organizationId,
      tx,
      params.bankAccountId,
    );
    const sourceCode = await this.resolveSourceBankAccountCode(organizationId, tx, {
      bankAccountId: params.bankAccountId,
      debitAccountCode: params.debitAccountCode,
    });

    const payDate = params.paymentDate ?? new Date();
    const { transactionId } = await this.postingJournal.postInTransaction(tx, {
      organizationId,
      schemaId: "VAT_DEPOSIT_ROUTE",
      amounts: { main: vatPortion },
      date: payDate,
      reference: params.reference ?? undefined,
      description:
        params.note?.trim() ||
        `ƏDV depozitə yönləndirmə (Dr ${depositCode} / Cr ${sourceCode}) ${vatPortion.toString()}`,
      dynamicAccounts: {
        debitAccountCode: depositCode,
        creditAccountCode: sourceCode,
      },
      counterpartyId: params.counterpartyId ?? undefined,
    });

    const ledgerEntry = await tx.vatDepositLedgerEntry.create({
      data: {
        organizationId,
        kind: VatDepositLedgerKind.INCOMING_ROUTE,
        amount: vatPortion,
        transactionId,
        note: params.note?.trim() || null,
      },
    });

    return { transactionId, ledgerEntryId: ledgerEntry.id };
  }

  async payVatFromDeposit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    params: {
      amount: Decimal | number | string;
      bankAccountId?: string | null;
      note?: string | null;
      paymentDate?: Date;
      reference?: string | null;
    },
  ) {
    const amount = new Decimal(params.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }

    const depositCode = await this.posting.resolveVatDepositAccountCode(
      organizationId,
      tx,
      params.bankAccountId,
    );
    const payDate = params.paymentDate ?? new Date();

    const { transactionId } = await this.postingJournal.postInTransaction(tx, {
      organizationId,
      schemaId: "VAT_DEPOSIT_REMITTANCE",
      amounts: { main: amount },
      date: payDate,
      reference: params.reference ?? undefined,
      description:
        params.note?.trim() ||
        `ƏDV depozitdən ödəniş (Dr output VAT / Cr ${depositCode}) ${amount.toString()}`,
      dynamicAccounts: { creditAccountCode: depositCode },
    });

    const ledgerEntry = await tx.vatDepositLedgerEntry.create({
      data: {
        organizationId,
        kind: VatDepositLedgerKind.REMITTANCE,
        amount,
        transactionId,
        note: params.note?.trim() || null,
      },
    });

    return { transactionId, ledgerEntryId: ledgerEntry.id };
  }

  async reconcile(
    organizationId: string,
    params: { dateFrom: string; dateTo: string },
  ) {
    const dateFrom = parseIsoDateOnly(params.dateFrom);
    const dateTo = parseIsoDateOnly(params.dateTo);
    if (dateFrom > dateTo) {
      throw new BadRequestException("dateFrom must be on or before dateTo");
    }
    const dateToEnd = new Date(dateTo);
    dateToEnd.setUTCHours(23, 59, 59, 999);

    const accountCode = await this.posting.resolveVatDepositAccountCode(organizationId);
    const acc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code: accountCode,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!acc) {
      throw new NotFoundException(`NAS account ${accountCode} is not provisioned`);
    }

    const glEntries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        accountId: acc.id,
        transaction: {
          date: { gte: dateFrom, lte: dateToEnd },
        },
      },
      select: { debit: true, credit: true },
    });

    let glNet = new Decimal(0);
    for (const row of glEntries) {
      glNet = glNet.add(d(row.debit).sub(d(row.credit)));
    }

    const depositBank = await this.prisma.organizationBankAccount.findFirst({
      where: {
        organizationId,
        accountType: BankAccountType.VAT_DEPOSIT,
        isArchived: false,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { bankName: true, iban: true },
    });

    let bankInflow = new Decimal(0);
    let bankOutflow = new Decimal(0);
    let bankLineCount = 0;
    let bankMatchNote =
      "Bank statement lines are not tagged by account type; matched by VAT_DEPOSIT bank name when configured.";

    if (depositBank?.bankName?.trim()) {
      const lines = await this.prisma.bankStatementLine.findMany({
        where: {
          organizationId,
          bankStatement: {
            bankName: depositBank.bankName.trim(),
            date: { gte: dateFrom, lte: dateToEnd },
          },
        },
        select: { amount: true, type: true },
      });
      bankLineCount = lines.length;
      for (const line of lines) {
        if (line.type === BankStatementLineType.INFLOW) {
          bankInflow = bankInflow.add(line.amount);
        } else if (line.type === BankStatementLineType.OUTFLOW) {
          bankOutflow = bankOutflow.add(line.amount);
        }
      }
    } else {
      bankMatchNote =
        "No VAT_DEPOSIT organization bank account configured; bank side omitted.";
    }

    const bankNet = bankInflow.sub(bankOutflow);
    const difference = glNet.sub(bankNet);

    return {
      period: { dateFrom: params.dateFrom, dateTo: params.dateTo },
      accountCode,
      gl: {
        netMovement: glNet.toFixed(4),
        entryCount: glEntries.length,
      },
      bank: {
        bankName: depositBank?.bankName ?? null,
        iban: depositBank?.iban ?? null,
        inflow: bankInflow.toFixed(4),
        outflow: bankOutflow.toFixed(4),
        netMovement: bankNet.toFixed(4),
        lineCount: bankLineCount,
        note: bankMatchNote,
      },
      difference: difference.toFixed(4),
      reconciled: difference.abs().lte(new Decimal("0.01")),
    };
  }

  /** Proportional VAT share of a customer payment based on invoice line VAT. */
  computeVatPortionFromItems(
    items: Array<{ lineTotal: Decimal; vatRate: Decimal }>,
    paymentAmount: Decimal,
  ): Decimal | null {
    let totalGross = new Decimal(0);
    let totalVat = new Decimal(0);
    for (const line of items) {
      const gross = d(line.lineTotal);
      if (gross.lte(0)) continue;
      const vatRate = Number(line.vatRate.toString());
      const vatExempt = vatRate < 0;
      const vatBasePct = vatExempt ? 0 : vatRate;
      const net = vatBasePct > 0 ? gross.div(new Decimal(1).add(vatBasePct / 100)) : gross;
      const vat = gross.sub(net);
      totalGross = totalGross.add(gross);
      totalVat = totalVat.add(vat);
    }
    if (totalGross.lte(0) || totalVat.lte(0)) return null;
    const portion = paymentAmount.mul(totalVat).div(totalGross);
    if (portion.lte(0)) return null;
    return portion;
  }

  async maybeRouteFromInvoicePayment(
    tx: Prisma.TransactionClient,
    organizationId: string,
    params: {
      invoiceId: string;
      paymentAmount: Decimal;
      debitAccountCode: string;
      counterpartyId: string;
      paymentDate: Date;
      invoiceNumber: string;
    },
  ): Promise<{ routed: boolean; vatPortion?: string; transactionId?: string }> {
    const org = await tx.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) return { routed: false };

    const settings = org.settings as Record<string, unknown> | null;
    const tax = settings?.tax;
    const isVatPayer =
      tax != null &&
      typeof tax === "object" &&
      Boolean((tax as Record<string, unknown>).isVatPayer);
    if (!isVatPayer) return { routed: false };

    const items = await tx.invoiceItem.findMany({
      where: { invoiceId: params.invoiceId },
      select: { lineTotal: true, vatRate: true },
    });
    const vatPortion = this.computeVatPortionFromItems(items, params.paymentAmount);
    if (!vatPortion || vatPortion.lte(0)) return { routed: false };

    const result = await this.routeIncomingVatPortion(tx, organizationId, {
      paymentAmount: params.paymentAmount,
      vatPortion,
      debitAccountCode: params.debitAccountCode,
      counterpartyId: params.counterpartyId,
      paymentDate: params.paymentDate,
      reference: params.invoiceNumber,
      note: `Auto-route VAT from invoice payment ${params.invoiceNumber}`,
    });

    return {
      routed: true,
      vatPortion: vatPortion.toFixed(4),
      transactionId: result.transactionId,
    };
  }
}
