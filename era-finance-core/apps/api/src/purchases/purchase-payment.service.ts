import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal, LedgerType, Prisma } from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import { decryptText } from "../security/pii-crypto.util";
import type { PayPurchaseDto } from "./dto/pay-purchase.dto";

const PAYMENT_REF_PREFIX = "PURCHASE_PAY:";

@Injectable()
export class PurchasePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  private async supplierPayableCode(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.posting.resolveAccountCode(organizationId, "SUPPLIER_PAYABLE", tx);
  }

  private async purchaseInvoiceUnpaid(
    organizationId: string,
    transactionId: string,
  ): Promise<{ counterpartyId: string | null; unpaid: Decimal }> {
    const tr = await this.prisma.transaction.findFirst({
      where: { id: transactionId, organizationId },
      include: {
        journalEntries: { include: { account: { select: { code: true } } } },
      },
    });
    if (!tr) throw new NotFoundException("Purchase invoice not found");
    const payableCode = await this.supplierPayableCode(organizationId);
    let liability = new Decimal(0);
    for (const je of tr.journalEntries) {
      if (je.account.code === payableCode) {
        liability = liability.add(je.credit).sub(je.debit);
      }
    }
    if (liability.lte(0)) {
      return { counterpartyId: tr.counterpartyId, unpaid: new Decimal(0) };
    }
    const paidAgg = await this.prisma.journalEntry.aggregate({
      where: {
        organizationId,
        debit: { gt: 0 },
        account: { code: payableCode },
        transaction: {
          reference: { startsWith: PAYMENT_REF_PREFIX },
          description: { contains: transactionId },
        },
      },
      _sum: { debit: true },
    });
    const paid = new Decimal(paidAgg._sum.debit ?? 0);
    const unpaid = liability.sub(paid);
    return {
      counterpartyId: tr.counterpartyId,
      unpaid: unpaid.gt(0) ? unpaid : new Decimal(0),
    };
  }

  private async resolveCreditAccount(
    organizationId: string,
    dto: PayPurchaseDto,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const cashAzn = await this.posting.resolveAccountCode(organizationId, "CASH_AZN", tx);
    let credit = dto.creditAccountCode?.trim() || cashAzn;
    if (dto.bankAccountId) {
      const bank = await tx.organizationBankAccount.findFirst({
        where: { id: dto.bankAccountId, organizationId, isArchived: false },
      });
      if (!bank?.ledgerAccountCode?.trim()) {
        throw new BadRequestException("Bank account not found or has no ledger code");
      }
      credit = bank.ledgerAccountCode.trim();
    }
    return credit;
  }

  async payPurchaseInvoice(
    organizationId: string,
    purchaseInvoiceId: string,
    dto: PayPurchaseDto,
  ) {
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }
    const { unpaid, counterpartyId } = await this.purchaseInvoiceUnpaid(
      organizationId,
      purchaseInvoiceId,
    );
    if (unpaid.lte(0)) {
      throw new BadRequestException("Purchase invoice has no outstanding payable balance");
    }
    if (amount.gt(unpaid)) {
      throw new BadRequestException(
        `amount exceeds unpaid balance (${unpaid.toFixed(4)})`,
      );
    }
    let payDate: Date;
    try {
      payDate = parseIsoDateOnly(dto.paymentDate.trim());
    } catch {
      throw new BadRequestException("Invalid paymentDate (expected YYYY-MM-DD)");
    }

    return this.prisma.$transaction(async (tx) => {
      const supplierCode = await this.supplierPayableCode(organizationId, tx);
      const credit = await this.resolveCreditAccount(organizationId, dto, tx);
      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: payDate,
        reference: `${PAYMENT_REF_PREFIX}${purchaseInvoiceId}`,
        description: `Purchase payment for ${purchaseInvoiceId}`,
        counterpartyId: counterpartyId ?? undefined,
        ledgerType: LedgerType.NAS,
        lines: [
          { accountCode: supplierCode, debit: amount.toString(), credit: "0" },
          { accountCode: credit, debit: "0", credit: amount.toString() },
        ],
      });
      return { transactionId, amount: amount.toString() };
    });
  }

  async listSupplierPayables(organizationId: string) {
    const supplierCode = await this.supplierPayableCode(organizationId);
    const acc = await this.prisma.account.findFirst({
      where: { organizationId, ledgerType: LedgerType.NAS, code: supplierCode },
    });
    if (!acc) {
      return { items: [] as Array<{ counterpartyId: string; counterpartyName: string; payable531: string }> };
    }
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        accountId: acc.id,
        transaction: { counterpartyId: { not: null } },
      },
      select: {
        debit: true,
        credit: true,
        transaction: { select: { counterpartyId: true } },
      },
    });
    const byCp = new Map<string, Decimal>();
    for (const e of entries) {
      const cpId = e.transaction.counterpartyId;
      if (!cpId) continue;
      const prev = byCp.get(cpId) ?? new Decimal(0);
      byCp.set(cpId, prev.add(e.credit).sub(e.debit));
    }
    const cpIds = [...byCp.keys()].filter((id) => (byCp.get(id) ?? new Decimal(0)).gt(0));
    const names = cpIds.length
      ? await this.prisma.counterparty.findMany({
          where: { organizationId, id: { in: cpIds } },
          select: {
            id: true,
            nameCipher: true,
            taxIdCipher: true,
            global: { select: { name: true } },
          },
        })
      : [];
    const nameById = new Map(
      names.map((c) => {
        const local =
          c.nameCipher != null ? decryptText(c.nameCipher)?.trim() ?? "" : "";
        const tax = c.taxIdCipher != null ? decryptText(c.taxIdCipher)?.trim() ?? "" : "";
        const label = c.global?.name?.trim() || local || tax || c.id;
        return [c.id, label] as const;
      }),
    );
    const items: Array<{ counterpartyId: string; counterpartyName: string; payable531: string }> = [];
    for (const [counterpartyId, net] of byCp) {
      if (net.gt(0)) {
        items.push({
          counterpartyId,
          counterpartyName: nameById.get(counterpartyId) ?? counterpartyId,
          payable531: net.toFixed(4),
        });
      }
    }
    items.sort((a, b) => a.counterpartyName.localeCompare(b.counterpartyName, "az"));
    return { items };
  }

  async paySupplierFifo(
    organizationId: string,
    counterpartyId: string,
    dto: PayPurchaseDto,
  ) {
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId },
    });
    if (!cp) throw new NotFoundException("Counterparty not found");

    const supplierCode = await this.supplierPayableCode(organizationId);
    const agg = await this.prisma.journalEntry.aggregate({
      where: {
        organizationId,
        account: { code: supplierCode },
        transaction: { counterpartyId },
      },
      _sum: { debit: true, credit: true },
    });
    const payable = new Decimal(agg._sum.credit ?? 0).sub(agg._sum.debit ?? 0);
    if (payable.lte(0)) {
      throw new BadRequestException("No supplier payable balance for this counterparty");
    }
    if (amount.gt(payable)) {
      throw new BadRequestException(
        `amount exceeds payable balance (${payable.toFixed(4)})`,
      );
    }

    let payDate: Date;
    try {
      payDate = parseIsoDateOnly(dto.paymentDate.trim());
    } catch {
      throw new BadRequestException("Invalid paymentDate (expected YYYY-MM-DD)");
    }

    return this.prisma.$transaction(async (tx) => {
      const credit = await this.resolveCreditAccount(organizationId, dto, tx);
      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: payDate,
        reference: "SUPPLIER_PAY",
        description: `Supplier payment (531) counterparty ${counterpartyId}`,
        counterpartyId,
        ledgerType: LedgerType.NAS,
        lines: [
          { accountCode: supplierCode, debit: amount.toString(), credit: "0" },
          { accountCode: credit, debit: "0", credit: amount.toString() },
        ],
      });
      return { transactionId, amount: amount.toString() };
    });
  }
}
