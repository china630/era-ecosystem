import { Injectable, Logger } from "@nestjs/common";
import { LedgerType, Prisma, type PostingRole } from "@erafinance/database";
import type {
  AccountingAdapter,
  AccountingDispatchResult,
} from "@era/contracts";
import {
  AccountingService,
  type PostTransactionLine,
} from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { InvoicesService } from "../invoices/invoices.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FinanceAccountingAdapterService implements AccountingAdapter {
  private readonly logger = new Logger(FinanceAccountingAdapterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly invoices: InvoicesService,
    private readonly posting: PostingAccountResolver,
  ) {}

  recordMetaOnly(meta: Record<string, unknown>): AccountingDispatchResult {
    this.logger.debug(`Accounting meta-only: ${JSON.stringify(meta)}`);
    return { meta };
  }

  async postBalancedRevenue(input: {
    organizationId: string;
    amount: number;
    reference: string;
    description: string;
    counterpartyId?: string | null;
    debitAccount?: string;
    creditAccount?: string;
  }): Promise<{ transactionId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const transactionId = await this.postBalancedJournal(tx, input.organizationId, input);
      return { transactionId };
    });
  }

  async postConsumptionCogs(input: {
    organizationId: string;
    amount: number;
    reference: string;
    description: string;
    counterpartyId?: string | null;
  }): Promise<{ transactionId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const debit = await this.satelliteGlAccount(
        input.organizationId,
        "SATELLITE_GL_COGS",
        "COGS",
        tx,
      );
      const credit = await this.satelliteGlAccount(
        input.organizationId,
        "SATELLITE_GL_INVENTORY",
        "INVENTORY_GOODS",
        tx,
      );
      const transactionId = await this.postBalancedJournal(tx, input.organizationId, {
        ...input,
        debitAccount: debit,
        creditAccount: credit,
      });
      return { transactionId };
    });
  }

  async createDraftInvoiceForEvent(input: {
    organizationId: string;
    counterpartyId: string;
    amount: number;
    description: string;
    sourceId: string;
  }): Promise<string | undefined> {
    if (input.amount <= 0) return undefined;
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + 30);
    const inv = await this.invoices.create(input.organizationId, {
      counterpartyId: input.counterpartyId,
      dueDate: dueDate.toISOString().slice(0, 10),
      items: [
        {
          description: `${input.description} (${input.sourceId})`,
          quantity: 1,
          unitPrice: input.amount,
          vatRate: 18,
        },
      ],
      currency: "AZN",
      vatInclusive: false,
    });
    return inv.id;
  }

  private async satelliteGlAccount(
    organizationId: string,
    envVar: string,
    role: PostingRole,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const override = process.env[envVar]?.trim();
    if (override) return override;
    return this.posting.resolveAccountCode(organizationId, role, tx);
  }

  private async postBalancedJournal(
    tx: Prisma.TransactionClient,
    organizationId: string,
    params: {
      amount: number;
      reference: string;
      description: string;
      counterpartyId?: string | null;
      debitAccount?: string;
      creditAccount?: string;
    },
  ): Promise<string> {
    const amount = Math.max(0, params.amount);
    if (amount <= 0) {
      throw new Error("Journal amount must be positive");
    }
    const debit =
      params.debitAccount ??
      (await this.satelliteGlAccount(
        organizationId,
        "SATELLITE_GL_RECEIVABLE",
        "TRADE_RECEIVABLE",
        tx,
      ));
    const credit =
      params.creditAccount ??
      (await this.satelliteGlAccount(
        organizationId,
        "SATELLITE_GL_REVENUE",
        "SALES_REVENUE",
        tx,
      ));
    const lines: PostTransactionLine[] = [
      { accountCode: debit, debit: amount, credit: 0 },
      { accountCode: credit, debit: 0, credit: amount },
    ];
    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date: new Date(),
      reference: params.reference,
      description: params.description,
      counterpartyId: params.counterpartyId ?? undefined,
      ledgerType: LedgerType.NAS,
      lines,
    });
    return transactionId;
  }
}
