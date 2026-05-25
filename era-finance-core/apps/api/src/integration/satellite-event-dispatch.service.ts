import { Injectable, Logger } from "@nestjs/common";
import {
  isSatelliteAutoWorkOrderCompleted,
  isSatelliteClinicLabOrderCompleted,
  isSatelliteClinicVisitCompleted,
  isSatelliteConstructionProgressActApproved,
  isSatelliteCrmLeadConverted,
  isSatelliteHotelReservationCompleted,
  isSatelliteLogisticsTripCompleted,
  isSatelliteRetailSaleCompleted,
  isSatelliteWholesaleOrderConfirmed,
  satelliteAutoWorkOrderCompletedSchema,
  satelliteClinicLabOrderCompletedSchema,
  satelliteClinicVisitCompletedSchema,
  satelliteConstructionProgressActSchema,
  satelliteCrmLeadConvertedSchema,
  satelliteHotelReservationCompletedSchema,
  satelliteLogisticsTripCompletedSchema,
  satelliteRetailSaleCompletedSchema,
  satelliteWholesaleOrderConfirmedSchema,
} from "@era/contracts";
import { LedgerType, Prisma } from "@erafinance/database";
import {
  AccountingService,
  type PostTransactionLine,
} from "../accounting/accounting.service";
import { InvoicesService } from "../invoices/invoices.service";
import { PrismaService } from "../prisma/prisma.service";

export type SatelliteDispatchResult = {
  transactionId?: string;
  invoiceId?: string;
  meta?: Record<string, unknown>;
};

@Injectable()
export class SatelliteEventDispatchService {
  private readonly logger = new Logger(SatelliteEventDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly invoices: InvoicesService,
  ) {}

  async dispatch(
    organizationId: string,
    data: unknown,
  ): Promise<SatelliteDispatchResult> {
    if (isSatelliteHotelReservationCompleted(data)) {
      const event = satelliteHotelReservationCompletedSchema.parse(data);
      return this.handleHotelReservation(organizationId, event);
    }
    if (isSatelliteRetailSaleCompleted(data)) {
      const event = satelliteRetailSaleCompletedSchema.parse(data);
      return this.handleRetailSale(organizationId, event);
    }
    if (isSatelliteLogisticsTripCompleted(data)) {
      const event = satelliteLogisticsTripCompletedSchema.parse(data);
      return this.handleLogisticsTrip(organizationId, event);
    }
    if (isSatelliteConstructionProgressActApproved(data)) {
      const event = satelliteConstructionProgressActSchema.parse(data);
      return this.handleConstructionAct(organizationId, event);
    }
    if (isSatelliteCrmLeadConverted(data)) {
      const event = satelliteCrmLeadConvertedSchema.parse(data);
      return this.handleCrmLead(organizationId, event);
    }
    if (isSatelliteAutoWorkOrderCompleted(data)) {
      const event = satelliteAutoWorkOrderCompletedSchema.parse(data);
      return this.handleAutoSto(organizationId, event);
    }
    if (isSatelliteClinicVisitCompleted(data)) {
      const event = satelliteClinicVisitCompletedSchema.parse(data);
      return this.handleClinicVisit(organizationId, event);
    }
    if (isSatelliteClinicLabOrderCompleted(data)) {
      const event = satelliteClinicLabOrderCompletedSchema.parse(data);
      return this.handleClinicLabOrder(organizationId, event);
    }
    if (isSatelliteWholesaleOrderConfirmed(data)) {
      const event = satelliteWholesaleOrderConfirmedSchema.parse(data);
      return this.handleWholesaleOrder(organizationId, event);
    }
    throw new Error("Unhandled satellite event type");
  }

  private receivableAccount(): string {
    return process.env.SATELLITE_GL_RECEIVABLE ?? "201";
  }

  private revenueAccount(): string {
    return process.env.SATELLITE_GL_REVENUE ?? "601";
  }

  private wipAccount(): string {
    return process.env.SATELLITE_GL_WIP ?? "111";
  }

  private async resolveCounterpartyId(
    organizationId: string,
    preferredId?: string,
  ): Promise<string | null> {
    if (preferredId) {
      const cp = await this.prisma.counterparty.findFirst({
        where: { id: preferredId, organizationId, deletedAt: null },
      });
      if (cp) return cp.id;
    }
    const envDefault = process.env.SATELLITE_DEFAULT_COUNTERPARTY_ID;
    if (envDefault) {
      const cp = await this.prisma.counterparty.findFirst({
        where: { id: envDefault, organizationId, deletedAt: null },
      });
      if (cp) return cp.id;
    }
    const first = await this.prisma.counterparty.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return first?.id ?? null;
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
    const debit = params.debitAccount ?? this.receivableAccount();
    const credit = params.creditAccount ?? this.revenueAccount();
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

  private dueDateIso(days = 30): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private async createDraftInvoice(
    organizationId: string,
    counterpartyId: string,
    amount: number,
    description: string,
    reference: string,
  ): Promise<string> {
    const inv = await this.invoices.create(organizationId, {
      counterpartyId,
      dueDate: this.dueDateIso(),
      debitAccountCode: "101",
      items: [
        {
          description: `${description} (${reference})`,
          quantity: 1,
          unitPrice: amount,
          vatRate: 18,
        },
      ],
      currency: "AZN",
      vatInclusive: false,
    });
    return inv.id;
  }

  private async handleHotelReservation(
    organizationId: string,
    event: ReturnType<typeof satelliteHotelReservationCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(organizationId);
    const transactionId = await this.prisma.$transaction(async (tx) =>
      this.postBalancedJournal(tx, organizationId, {
        amount: event.payload.amountNet,
        reference: `hotel:${event.payload.reservationId}`,
        description: `Hotel reservation completed (${event.correlationId})`,
        counterpartyId: cpId,
      }),
    );
    let invoiceId: string | undefined;
    if (cpId) {
      invoiceId = await this.createDraftInvoice(
        organizationId,
        cpId,
        event.payload.amountNet,
        "Hotel folio revenue",
        event.payload.reservationId,
      );
    }
    return {
      transactionId,
      invoiceId,
      meta: { reservationId: event.payload.reservationId },
    };
  }

  private async handleRetailSale(
    organizationId: string,
    event: ReturnType<typeof satelliteRetailSaleCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(organizationId);
    const transactionId = await this.prisma.$transaction(async (tx) =>
      this.postBalancedJournal(tx, organizationId, {
        amount: event.payload.amountNet,
        reference: `retail:${event.payload.receiptId}`,
        description: `Retail sale ${event.payload.preset} (${event.correlationId})`,
        counterpartyId: cpId,
      }),
    );
    let invoiceId: string | undefined;
    if (cpId) {
      invoiceId = await this.createDraftInvoice(
        organizationId,
        cpId,
        event.payload.amountNet,
        `Retail POS ${event.payload.preset}`,
        event.payload.receiptId,
      );
    }
    return {
      transactionId,
      invoiceId,
      meta: { receiptId: event.payload.receiptId, preset: event.payload.preset },
    };
  }

  private async handleLogisticsTrip(
    organizationId: string,
    event: ReturnType<typeof satelliteLogisticsTripCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(organizationId);
    return this.prisma.$transaction(async (tx) => {
      const transactionId = await this.postBalancedJournal(tx, organizationId, {
        amount: event.payload.freightAmount,
        reference: `logistics:${event.payload.tripId}`,
        description: `Logistics trip completed (${event.correlationId})`,
        counterpartyId: cpId,
      });
      return { transactionId, meta: { tripId: event.payload.tripId } };
    });
  }

  private async handleConstructionAct(
    organizationId: string,
    event: ReturnType<typeof satelliteConstructionProgressActSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    return this.prisma.$transaction(async (tx) => {
      const transactionId = await this.postBalancedJournal(tx, organizationId, {
        amount: event.payload.amountNet,
        reference: `construction:${event.payload.actId}`,
        description: `Construction progress act (${event.correlationId})`,
        debitAccount: this.receivableAccount(),
        creditAccount: this.wipAccount(),
      });
      return {
        transactionId,
        meta: { projectId: event.payload.projectId, actId: event.payload.actId },
      };
    });
  }

  private async handleCrmLead(
    organizationId: string,
    event: ReturnType<typeof satelliteCrmLeadConvertedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(
      organizationId,
      event.payload.counterpartyId,
    );
    let invoiceId: string | undefined;
    if (cpId && event.payload.estimatedAmount && event.payload.estimatedAmount > 0) {
      invoiceId = await this.createDraftInvoice(
        organizationId,
        cpId,
        event.payload.estimatedAmount,
        `CRM lead ${event.payload.channel}`,
        event.payload.leadId,
      );
    }
    return {
      invoiceId,
      meta: { leadId: event.payload.leadId, counterpartyId: cpId },
    };
  }

  private async handleAutoSto(
    organizationId: string,
    event: ReturnType<typeof satelliteAutoWorkOrderCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const amount = event.payload.laborAmount + event.payload.partsAmount;
    const cpId = await this.resolveCounterpartyId(organizationId);
    const transactionId = await this.prisma.$transaction(async (tx) =>
      this.postBalancedJournal(tx, organizationId, {
        amount,
        reference: `auto:${event.payload.workOrderId}`,
        description: `Auto STO work order closed (${event.correlationId})`,
        counterpartyId: cpId,
      }),
    );
    let invoiceId: string | undefined;
    if (cpId) {
      invoiceId = await this.createDraftInvoice(
        organizationId,
        cpId,
        amount,
        "Auto STO service",
        event.payload.workOrderId,
      );
    }
    return { transactionId, invoiceId, meta: { workOrderId: event.payload.workOrderId } };
  }

  private async handleClinicVisit(
    organizationId: string,
    event: ReturnType<typeof satelliteClinicVisitCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(organizationId);
    const amount = event.payload.amountNet;
    const transactionId = await this.prisma.$transaction(async (tx) =>
      this.postBalancedJournal(tx, organizationId, {
        amount,
        reference: `clinic:${event.payload.visitId}`,
        description: `Clinic visit completed (${event.correlationId})`,
        counterpartyId: cpId,
      }),
    );
    let invoiceId: string | undefined;
    if (cpId) {
      invoiceId = await this.createDraftInvoice(
        organizationId,
        cpId,
        amount,
        "Clinic services",
        event.payload.visitId,
      );
    }
    return { transactionId, invoiceId, meta: { visitId: event.payload.visitId } };
  }

  private async handleClinicLabOrder(
    organizationId: string,
    event: ReturnType<typeof satelliteClinicLabOrderCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    this.logger.log(
      `Clinic lab order completed stub: ${event.payload.labOrderId} (${event.correlationId})`,
    );
    return {
      meta: {
        labOrderId: event.payload.labOrderId,
        patientRef: event.payload.patientRef,
        testCode: event.payload.testCode,
        amountNet: event.payload.amountNet,
        stub: true,
      },
    };
  }

  private async handleWholesaleOrder(
    organizationId: string,
    event: ReturnType<typeof satelliteWholesaleOrderConfirmedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(
      organizationId,
      event.payload.buyerCounterpartyId,
    );
    if (!cpId) {
      this.logger.warn(
        `Wholesale order ${event.payload.orderId}: no counterparty; skipping invoice`,
      );
      return this.prisma.$transaction(async (tx) => {
        const transactionId = await this.postBalancedJournal(tx, organizationId, {
          amount: event.payload.amountNet,
          reference: `wholesale:${event.payload.orderId}`,
          description: `Wholesale order (${event.correlationId})`,
        });
        return { transactionId, meta: { orderId: event.payload.orderId } };
      });
    }
    const transactionId = await this.prisma.$transaction(async (tx) =>
      this.postBalancedJournal(tx, organizationId, {
        amount: event.payload.amountNet,
        reference: `wholesale:${event.payload.orderId}`,
        description: `Wholesale order confirmed (${event.correlationId})`,
        counterpartyId: cpId,
      }),
    );
    const invoiceId = await this.createDraftInvoice(
      organizationId,
      cpId,
      event.payload.amountNet,
      "Wholesale B2B order",
      event.payload.orderId,
    );
    return { transactionId, invoiceId, meta: { orderId: event.payload.orderId } };
  }
}
