import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CashOrderKind,
  CashOrderStatus,
  InvoiceStatus,
  Prisma,
  TransactionKind,
} from "@erafinance/database";
import { bakuMonthBounds } from "@era/satellite-kit/time";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ClassifyFactMeaningDto } from "./dto/classify-fact-meaning.dto";
import {
  FactQueueNotEmptyError,
  assertFactQueueAllowsClose,
  bankLineInFactQueue,
  cashOrderInFactQueue,
  counterpartyMeaningAllowed,
  journalLinesForMeaning,
  meaningDirection,
  offsetRole,
  shouldPostMeaningJournal,
  type FactMeaningCode,
  type FactQueueItem,
} from "./fact-queue";

function ymdUtc(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

@Injectable()
export class FactQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  async list(organizationId: string, year: number, month: number) {
    const period = periodKey(year, month);
    const { from, to } = bakuMonthBounds(period);
    const [bankLines, cashOrders, invoices, purchases] = await Promise.all([
      this.prisma.bankStatementLine.findMany({
        where: {
          organizationId,
          isMatched: false,
          factMeaning: null,
          OR: [
            { valueDate: { gte: from, lte: to } },
            { valueDate: null, bankStatement: { date: { gte: from, lte: to } } },
          ],
        },
        include: { bankStatement: { select: { date: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      this.prisma.cashOrder.findMany({
        where: {
          organizationId,
          status: CashOrderStatus.POSTED,
          sourceInvoiceId: null,
          sourceInvoicePaymentId: null,
          factMeaning: null,
          date: { gte: from, lte: to },
        },
        include: {
          counterparty: { select: { id: true, role: true, isFounder: true } },
        },
        orderBy: { date: "asc" },
        take: 200,
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
        },
        select: { id: true, number: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.transaction.findMany({
        where: {
          organizationId,
          kind: TransactionKind.SYSTEM,
          purchaseSnapshot: { not: Prisma.DbNull },
        },
        select: { id: true, reference: true, description: true },
        orderBy: { date: "desc" },
        take: 100,
      }),
    ]);

    const rows: FactQueueItem[] = [];
    for (const line of bankLines) {
      if (!bankLineInFactQueue(line)) continue;
      const when = line.valueDate ?? line.bankStatement.date;
      rows.push({
        source: "BANK",
        id: line.id,
        date: ymdUtc(when),
        amount: line.amount.toString(),
        direction: line.type === "INFLOW" ? "IN" : "OUT",
        label: line.description?.trim() || line.id,
        counterpartyId: null,
        counterpartyRole: null,
        isFounder: false,
      });
    }
    for (const order of cashOrders) {
      if (!cashOrderInFactQueue(order)) continue;
      rows.push({
        source: "CASH",
        id: order.id,
        date: ymdUtc(order.date),
        amount: order.amount.toString(),
        direction: order.kind === CashOrderKind.KMO ? "IN" : "OUT",
        label: order.orderNumber,
        counterpartyId: order.counterpartyId,
        counterpartyRole: order.counterparty?.role ?? null,
        isFounder: order.counterparty?.isFounder ?? false,
      });
    }

    return {
      period,
      count: rows.length,
      rows,
      invoices: invoices.map((row) => ({ id: row.id, label: row.number })),
      purchases: purchases.map((row) => ({
        id: row.id,
        label: row.reference?.trim() || row.description?.trim() || row.id,
      })),
    };
  }

  async assertEmptyForClose(organizationId: string, year: number, month: number): Promise<void> {
    const { rows } = await this.list(organizationId, year, month);
    try {
      assertFactQueueAllowsClose(rows);
    } catch (error) {
      if (error instanceof FactQueueNotEmptyError) {
        throw new ConflictException({
          code: error.code,
          message: error.message,
          gaps: error.gaps,
        });
      }
      throw error;
    }
  }

  async classify(organizationId: string, dto: ClassifyFactMeaningDto) {
    if (dto.source === "BANK") {
      return this.classifyBank(organizationId, dto);
    }
    return this.classifyCash(organizationId, dto);
  }

  private async classifyBank(organizationId: string, dto: ClassifyFactMeaningDto) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: dto.id, organizationId },
      include: { bankStatement: { select: { date: true } } },
    });
    if (!line) throw new NotFoundException("Bank line not found");
    if (line.factMeaning) {
      throw new BadRequestException("This line already has a meaning");
    }
    const direction = line.type === "INFLOW" ? "IN" : "OUT";
    const linked = await this.resolveLinks(organizationId, dto);
    await this.assertMeaningFits(organizationId, dto, direction, null, linked.counterpartyId);
    const when = line.valueDate ?? line.bankStatement.date;
    const factTransactionId = await this.postIfNeeded({
      organizationId,
      dto,
      direction,
      amount: line.amount.toString(),
      date: when,
      alreadyPosted: line.factTransactionId != null,
      moneyRole: "MAIN_BANK",
      reference: `FACT:BANK:${line.id}`,
      counterpartyId: linked.counterpartyId,
    });
    await this.prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        factMeaning: dto.meaning,
        factConfirmedMismatch: dto.confirmMismatch === true,
        factCounterpartyId: linked.counterpartyId,
        factPurchaseTransactionId: linked.purchaseTransactionId,
        ...(factTransactionId ? { factTransactionId } : {}),
        ...(dto.meaning === "CUSTOMER_PAYMENT"
          ? { isMatched: true, matchedInvoiceId: linked.invoiceId }
          : {}),
      },
    });
    return { id: line.id, source: "BANK" as const, meaning: dto.meaning, posted: factTransactionId != null && line.factTransactionId == null };
  }

  private async classifyCash(organizationId: string, dto: ClassifyFactMeaningDto) {
    const order = await this.prisma.cashOrder.findFirst({
      where: { id: dto.id, organizationId },
      include: { counterparty: { select: { id: true, role: true, isFounder: true } } },
    });
    if (!order) throw new NotFoundException("Cash order not found");
    if (order.status !== CashOrderStatus.POSTED) {
      throw new BadRequestException("Only a posted cash order is in the fact queue");
    }
    if (order.factMeaning) {
      throw new BadRequestException("This order already has a meaning");
    }
    const direction = order.kind === CashOrderKind.KMO ? "IN" : "OUT";
    const linked = await this.resolveLinks(organizationId, dto);
    const party = order.counterparty
      ? { role: order.counterparty.role, isFounder: order.counterparty.isFounder }
      : null;
    await this.assertMeaningFits(
      organizationId,
      dto,
      direction,
      party,
      linked.counterpartyId ?? order.counterpartyId,
    );
    const factTransactionId = await this.postIfNeeded({
      organizationId,
      dto,
      direction,
      amount: order.amount.toString(),
      date: order.date,
      alreadyPosted: order.postedTransactionId != null || order.factTransactionId != null,
      moneyRole: "CASH_AZN",
      reference: `FACT:CASH:${order.id}`,
      counterpartyId: linked.counterpartyId ?? order.counterpartyId,
    });
    await this.prisma.cashOrder.update({
      where: { id: order.id },
      data: {
        factMeaning: dto.meaning,
        factConfirmedMismatch: dto.confirmMismatch === true,
        factPurchaseTransactionId: linked.purchaseTransactionId,
        ...(factTransactionId ? { factTransactionId } : {}),
        ...(dto.meaning === "CUSTOMER_PAYMENT" && linked.invoiceId
          ? { sourceInvoiceId: linked.invoiceId }
          : {}),
        ...(!order.counterpartyId && linked.counterpartyId
          ? { counterpartyId: linked.counterpartyId }
          : {}),
      },
    });
    return {
      id: order.id,
      source: "CASH" as const,
      meaning: dto.meaning,
      posted: factTransactionId != null && order.factTransactionId == null && order.postedTransactionId == null,
    };
  }

  private async assertMeaningFits(
    organizationId: string,
    dto: ClassifyFactMeaningDto,
    direction: "IN" | "OUT",
    knownParty: { role: FactQueueItem["counterpartyRole"]; isFounder: boolean } | null,
    knownCounterpartyId?: string | null,
  ) {
    const expected = meaningDirection(dto.meaning);
    if (expected !== "EITHER" && expected !== direction) {
      throw new BadRequestException("This meaning does not match the money direction");
    }
    const counterpartyId = dto.counterpartyId ?? knownCounterpartyId ?? null;
    let role = knownParty?.role ?? null;
    let isFounder = knownParty?.isFounder ?? false;
    if (counterpartyId) {
      const party = await this.prisma.counterparty.findFirst({
        where: { id: counterpartyId, organizationId },
        select: { role: true, isFounder: true },
      });
      if (!party) throw new NotFoundException("Counterparty not found");
      role = party.role;
      isFounder = party.isFounder;
    }
    if (
      counterpartyId &&
      !counterpartyMeaningAllowed({
        meaning: dto.meaning,
        role,
        isFounder,
        confirmMismatch: dto.confirmMismatch === true,
      })
    ) {
      throw new BadRequestException({
        code: "FACT_MEANING_MISMATCH",
        message: "Confirm that this counterparty is not what it looks like",
      });
    }
  }

  private async resolveLinks(organizationId: string, dto: ClassifyFactMeaningDto) {
    let invoiceId: string | null = null;
    let purchaseTransactionId: string | null = null;
    let counterpartyId = dto.counterpartyId ?? null;
    if (dto.meaning === "CUSTOMER_PAYMENT") {
      if (!dto.invoiceId) {
        throw new BadRequestException("Customer payment needs an invoice");
      }
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, organizationId },
        select: { id: true, status: true, counterpartyId: true },
      });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException("Draft or cancelled invoice cannot clear the queue");
      }
      invoiceId = invoice.id;
      counterpartyId = counterpartyId ?? invoice.counterpartyId;
    }
    if (dto.meaning === "SUPPLIER_PAYMENT") {
      if (!dto.purchaseTransactionId) {
        throw new BadRequestException("Supplier payment needs a purchase");
      }
      const purchase = await this.prisma.transaction.findFirst({
        where: { id: dto.purchaseTransactionId, organizationId },
        select: { id: true, kind: true, counterpartyId: true, purchaseSnapshot: true },
      });
      if (!purchase || purchase.purchaseSnapshot == null) {
        throw new NotFoundException("Purchase not found");
      }
      if (purchase.kind === TransactionKind.MANUAL_ADJUSTMENT) {
        throw new BadRequestException({
          code: "FACT_QUEUE_MANUAL_JOURNAL",
          message: "A manual journal does not give the line a meaning",
        });
      }
      purchaseTransactionId = purchase.id;
      counterpartyId = counterpartyId ?? purchase.counterpartyId;
    }
    return { invoiceId, purchaseTransactionId, counterpartyId };
  }

  private async postIfNeeded(input: {
    organizationId: string;
    dto: ClassifyFactMeaningDto;
    direction: "IN" | "OUT";
    amount: string;
    date: Date;
    alreadyPosted: boolean;
    moneyRole: "MAIN_BANK" | "CASH_AZN";
    reference: string;
    counterpartyId: string | null;
  }): Promise<string | null> {
    if (
      !shouldPostMeaningJournal({
        meaning: input.dto.meaning,
        alreadyPosted: input.alreadyPosted,
      })
    ) {
      return null;
    }
    const existing = await this.prisma.transaction.findFirst({
      where: { organizationId: input.organizationId, reference: input.reference },
      select: { id: true },
    });
    if (existing) return existing.id;
    const role = offsetRole(input.dto.meaning);
    if (!role) return null;
    const [moneyAccount, offsetAccount] = await Promise.all([
      this.posting.resolveAccountCode(input.organizationId, input.moneyRole),
      this.posting.resolveAccountCode(input.organizationId, role),
    ]);
    const lines = journalLinesForMeaning({
      meaning: input.dto.meaning,
      direction: input.direction,
      moneyAccount,
      offsetAccount,
      amount: input.amount,
    });
    if (!lines) return null;
    const posted = await this.accounting.postTransaction({
      organizationId: input.organizationId,
      date: input.date,
      reference: input.reference,
      description: input.dto.meaning,
      isFinal: true,
      kind: TransactionKind.SYSTEM,
      counterpartyId: input.counterpartyId,
      lines,
    });
    return posted.transactionId;
  }
}
