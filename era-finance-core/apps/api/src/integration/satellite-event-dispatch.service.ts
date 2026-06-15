import { Injectable, Logger } from "@nestjs/common";
import {
  isSatelliteAutoWorkOrderCompleted,
  isSatelliteClinicLabOrderCompleted,
  isSatelliteClinicPrescriptionIssued,
  isSatelliteClinicProcedureCompleted,
  isSatelliteClinicVisitCompleted,
  isSatelliteClinicWardDayCharge,
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelGuestCheckedOut,
  isSatelliteHotelRoomChanged,
  isSatelliteConstructionProgressActApproved,
  isSatelliteCrmLeadConverted,
  isSatelliteCrmVisitLogged,
  isSatelliteHotelNightAuditClosed,
  isSatelliteHotelReservationCompleted,
  isSatelliteHotelInvoiceIssued,
  isSatelliteHotelCityLedgerSnapshot,
  isSatelliteLogisticsTripCompleted,
  isSatelliteRetailSaleCompleted,
  isSatelliteRetailShiftClosed,
  isSatelliteWholesaleOrderConfirmed,
  isSatelliteFbStockConsumptionCompleted,
  isSatelliteStaffClockBatch,
  satelliteStaffClockBatchSchema,
  satelliteAutoWorkOrderCompletedSchema,
  satelliteClinicLabOrderCompletedSchema,
  satelliteClinicPrescriptionIssuedSchema,
  satelliteClinicProcedureCompletedSchema,
  satelliteClinicVisitCompletedSchema,
  satelliteClinicWardDayChargeSchema,
  satelliteHotelGuestCheckedInSchema,
  satelliteHotelGuestCheckedOutSchema,
  satelliteHotelRoomChangedSchema,
  satelliteConstructionProgressActSchema,
  satelliteCrmLeadConvertedSchema,
  satelliteCrmVisitLoggedSchema,
  satelliteHotelNightAuditClosedSchema,
  satelliteHotelReservationCompletedSchema,
  satelliteHotelInvoiceIssuedSchema,
  satelliteHotelCityLedgerSnapshotSchema,
  satelliteLogisticsTripCompletedSchema,
  satelliteRetailSaleCompletedSchema,
  satelliteRetailShiftClosedSchema,
  satelliteWholesaleOrderConfirmedSchema,
  satelliteFbStockConsumptionCompletedSchema,
  isSatelliteBankGlDailySummary,
  satelliteBankGlDailySummarySchema,
} from "@era/contracts";
import { LedgerType, Prisma, type PostingRole } from "@erafinance/database";
import {
  AccountingService,
  type PostTransactionLine,
} from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { InvoicesService } from "../invoices/invoices.service";
import { PrismaService } from "../prisma/prisma.service";
import { TimesheetService } from "../hr/timesheet.service";

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
    private readonly posting: PostingAccountResolver,
    private readonly timesheet: TimesheetService,
  ) {}

  async dispatch(
    organizationId: string,
    data: unknown,
  ): Promise<SatelliteDispatchResult> {
    if (isSatelliteHotelNightAuditClosed(data)) {
      const event = satelliteHotelNightAuditClosedSchema.parse(data);
      return this.handleHotelNightAudit(organizationId, event);
    }
    if (isSatelliteHotelInvoiceIssued(data)) {
      const event = satelliteHotelInvoiceIssuedSchema.parse(data);
      return this.handleHotelInvoiceIssued(organizationId, event);
    }
    if (isSatelliteHotelCityLedgerSnapshot(data)) {
      const event = satelliteHotelCityLedgerSnapshotSchema.parse(data);
      return this.handleHotelCityLedgerSnapshot(organizationId, event);
    }
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
    if (isSatelliteClinicProcedureCompleted(data)) {
      const event = satelliteClinicProcedureCompletedSchema.parse(data);
      return this.handleClinicProcedure(organizationId, event);
    }
    if (isSatelliteClinicPrescriptionIssued(data)) {
      const event = satelliteClinicPrescriptionIssuedSchema.parse(data);
      return this.handleClinicPrescription(organizationId, event);
    }
    if (isSatelliteClinicWardDayCharge(data)) {
      const event = satelliteClinicWardDayChargeSchema.parse(data);
      return this.handleClinicWardDayCharge(organizationId, event);
    }
    if (isSatelliteHotelGuestCheckedIn(data)) {
      const event = satelliteHotelGuestCheckedInSchema.parse(data);
      return this.handleHotelGuestLifecycle(organizationId, event, "checked_in");
    }
    if (isSatelliteHotelGuestCheckedOut(data)) {
      const event = satelliteHotelGuestCheckedOutSchema.parse(data);
      return this.handleHotelGuestLifecycle(organizationId, event, "checked_out");
    }
    if (isSatelliteHotelRoomChanged(data)) {
      const event = satelliteHotelRoomChangedSchema.parse(data);
      return this.handleHotelGuestLifecycle(organizationId, event, "room_changed");
    }
    if (isSatelliteWholesaleOrderConfirmed(data)) {
      const event = satelliteWholesaleOrderConfirmedSchema.parse(data);
      return this.handleWholesaleOrder(organizationId, event);
    }
    if (isSatelliteRetailShiftClosed(data)) {
      const event = satelliteRetailShiftClosedSchema.parse(data);
      return this.handleRetailShiftClosed(organizationId, event);
    }
    if (isSatelliteCrmVisitLogged(data)) {
      const event = satelliteCrmVisitLoggedSchema.parse(data);
      return this.handleCrmVisitLogged(organizationId, event);
    }
    if (isSatelliteFbStockConsumptionCompleted(data)) {
      const event = satelliteFbStockConsumptionCompletedSchema.parse(data);
      return this.handleFbStockConsumption(organizationId, event);
    }
    if (isSatelliteStaffClockBatch(data)) {
      const event = satelliteStaffClockBatchSchema.parse(data);
      const result = await this.timesheet.ingestStaffClockBatch(
        organizationId,
        event.payload.events,
      );
      return { meta: result };
    }
    if (isSatelliteBankGlDailySummary(data)) {
      const event = satelliteBankGlDailySummarySchema.parse(data);
      return this.handleBankGlDailySummary(organizationId, event);
    }
    throw new Error("Unhandled satellite event type");
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

  private async handleHotelInvoiceIssued(
    organizationId: string,
    event: ReturnType<typeof satelliteHotelInvoiceIssuedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const total = event.payload.lines.reduce(
      (sum, line) => sum + line.amount * line.qty,
      0,
    );
    let counterpartyId = await this.resolveCounterpartyId(organizationId);
    if (!counterpartyId) {
      this.logger.warn(
        `Hotel invoice ${event.payload.invoiceNumber}: no counterparty; skipping invoice`,
      );
      return {
        meta: {
          folioId: event.payload.folioId,
          skipped: true,
          reason: "no counterparty",
        },
      };
    }
    const invoiceId = await this.invoices.create(organizationId, {
      counterpartyId,
      dueDate: event.payload.issueDate,
      items: event.payload.lines.map((line: { description: string; qty: number; amount: number; vatRate?: number }) => ({
        description: `${line.description} (${event.payload.invoiceNumber})`,
        quantity: line.qty,
        unitPrice: line.amount,
        vatRate: line.vatRate ?? 18,
      })),
      currency: "AZN",
      vatInclusive: false,
    });
    return {
      invoiceId: invoiceId.id,
      meta: {
        folioId: event.payload.folioId,
        invoiceNumber: event.payload.invoiceNumber,
        total,
      },
    };
  }

  private async handleHotelCityLedgerSnapshot(
    organizationId: string,
    event: ReturnType<typeof satelliteHotelCityLedgerSnapshotSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const counterpartyId = await this.resolveCounterpartyId(
      organizationId,
      event.payload.agencyId,
    );
    const snapshot = await this.prisma.agencyCityLedgerSnapshot.create({
      data: {
        organizationId,
        hotelAgencyId: event.payload.agencyId,
        agencyCode: event.payload.agencyCode,
        asOfDate: event.payload.asOfDate,
        balance: event.payload.balance,
        periodCharges: event.payload.periodCharges,
        periodPayments: event.payload.periodPayments,
        currency: event.payload.currency,
        correlationId: event.correlationId,
        counterpartyId,
      },
    });
    this.logger.log(
      `City ledger snapshot persisted id=${snapshot.id} agency=${event.payload.agencyCode} balance=${event.payload.balance} asOf=${event.payload.asOfDate} (${event.correlationId})`,
    );
    return {
      meta: {
        snapshotId: snapshot.id,
        agencyId: event.payload.agencyId,
        agencyCode: event.payload.agencyCode,
        asOfDate: event.payload.asOfDate,
        balance: event.payload.balance,
        periodCharges: event.payload.periodCharges,
        periodPayments: event.payload.periodPayments,
        counterpartyId,
        reconciliationNote: `Hotel agency ${event.payload.agencyCode} balance ${event.payload.balance} AZN on ${event.payload.asOfDate}`,
      },
    };
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

  private async handleHotelNightAudit(
    organizationId: string,
    event: ReturnType<typeof satelliteHotelNightAuditClosedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const revenueLines = event.payload.revenueLines.filter((l) => l.amount > 0);
    const totalRevenue = revenueLines.reduce((sum, line) => sum + line.amount, 0);
    const totalPayments = event.payload.paymentLines.reduce((sum, line) => sum + line.amount, 0);
    if (totalRevenue <= 0) {
      return {
        meta: {
          businessDate: event.payload.businessDate,
          skipped: true,
          reason: "zero revenue",
        },
      };
    }

    const [revenueDefault, cashDefault, receivableDefault] = await Promise.all([
      this.satelliteGlAccount(organizationId, "SATELLITE_GL_REVENUE", "SALES_REVENUE"),
      this.satelliteGlAccount(organizationId, "SATELLITE_GL_CASH", "MAIN_BANK"),
      this.satelliteGlAccount(organizationId, "SATELLITE_GL_RECEIVABLE", "TRADE_RECEIVABLE"),
    ]);

    const lines: PostTransactionLine[] = [];
    for (const line of revenueLines) {
      lines.push({
        accountCode: line.glAccountCode || revenueDefault,
        debit: 0,
        credit: line.amount,
      });
    }
    const arAmount = Math.max(0, totalRevenue - totalPayments);
    if (totalPayments > 0) {
      lines.push({
        accountCode: cashDefault,
        debit: totalPayments,
        credit: 0,
      });
    }
    if (arAmount > 0) {
      lines.push({
        accountCode: receivableDefault,
        debit: arAmount,
        credit: 0,
      });
    }

    const transactionId = await this.prisma.$transaction(async (tx) => {
      const debit = lines.reduce((s, l) => s + Number(l.debit), 0);
      const credit = lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(debit - credit) > 0.01) {
        throw new Error("Night audit journal is not balanced");
      }
      const { transactionId: txId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: new Date(`${event.payload.businessDate}T12:00:00.000Z`),
        reference: `hotel-na:${event.payload.businessDate}`,
        description: `Hotel night audit ${event.payload.businessDate} (${event.correlationId})`,
        ledgerType: LedgerType.NAS,
        lines,
      });
      return txId;
    });

    return {
      transactionId,
      meta: {
        businessDate: event.payload.businessDate,
        nightAuditId: event.payload.nightAuditId,
        revenueLineCount: revenueLines.length,
        totalRevenue,
        totalPayments,
      },
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
      const [receivableDefault, wipDefault] = await Promise.all([
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_RECEIVABLE", "TRADE_RECEIVABLE", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_WIP", "WIP_MANUFACTURING", tx),
      ]);
      const transactionId = await this.postBalancedJournal(tx, organizationId, {
        amount: event.payload.amountNet,
        reference: `construction:${event.payload.actId}`,
        description: `Construction progress act (${event.correlationId})`,
        debitAccount: receivableDefault,
        creditAccount: wipDefault,
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
    const cpId = await this.resolveCounterpartyId(organizationId);
    const amount = event.payload.amountNet;
    const transactionId = await this.prisma.$transaction(async (tx) =>
      this.postBalancedJournal(tx, organizationId, {
        amount,
        reference: `clinic-lab:${event.payload.labOrderId}`,
        description: `Clinic lab order completed (${event.correlationId})`,
        counterpartyId: cpId,
      }),
    );
    let invoiceId: string | undefined;
    if (cpId) {
      invoiceId = await this.createDraftInvoice(
        organizationId,
        cpId,
        amount,
        "Clinic lab services",
        event.payload.labOrderId,
      );
    }
    return {
      transactionId,
      invoiceId,
      meta: { labOrderId: event.payload.labOrderId },
    };
  }

  private async handleRetailShiftClosed(
    organizationId: string,
    event: ReturnType<typeof satelliteRetailShiftClosedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    this.logger.log(
      `Retail shift closed (cash recon stub): ${event.payload.shiftId} totalSales=${event.payload.totalSales} (${event.correlationId})`,
    );
    return {
      meta: {
        shiftId: event.payload.shiftId,
        totalSales: event.payload.totalSales,
      },
    };
  }

  private async handleCrmVisitLogged(
    organizationId: string,
    event: ReturnType<typeof satelliteCrmVisitLoggedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    this.logger.log(
      `CRM visit logged: visit=${event.payload.visitId} lead=${event.payload.leadId} (${event.correlationId})`,
    );
    return {
      meta: {
        visitId: event.payload.visitId,
        leadId: event.payload.leadId,
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

  private async handleClinicProcedure(
    organizationId: string,
    event: ReturnType<typeof satelliteClinicProcedureCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    if (event.payload.patientOrigin === "IN_HOUSE") {
      this.logger.log(
        `Clinic procedure ${event.payload.procedureCode} billed to folio (reservation=${event.payload.reservationId})`,
      );
      return {
        meta: {
          procedureCode: event.payload.procedureCode,
          patientOrigin: "IN_HOUSE",
          reservationId: event.payload.reservationId,
          lineCount: event.payload.lines.length,
        },
      };
    }
    const cpId = await this.resolveCounterpartyId(organizationId);
    const amount = event.payload.amountNet;
    const transactionId = await this.prisma.$transaction(async (tx) => {
      const revenueId = await this.postBalancedJournal(tx, organizationId, {
        amount,
        reference: `clinic-procedure:${event.payload.procedureCode}:${event.correlationId}`,
        description: `Clinic procedure completed (${event.correlationId})`,
        counterpartyId: cpId,
      });
      const [wipDefault, cogsDefault] = await Promise.all([
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_WIP", "WIP_MANUFACTURING", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_COGS", "COGS", tx),
      ]);
      await this.postBalancedJournal(tx, organizationId, {
        amount: Math.max(0.01, event.payload.lines.reduce((s, l) => s + l.qty, 0)),
        reference: `clinic-procedure-cogs:${event.correlationId}`,
        description: `Clinic procedure consumables (${event.correlationId})`,
        counterpartyId: cpId,
        debitAccount: wipDefault,
        creditAccount: cogsDefault,
      });
      return revenueId;
    });
    return {
      transactionId,
      meta: {
        procedureCode: event.payload.procedureCode,
        lineCount: event.payload.lines.length,
      },
    };
  }

  private async handleClinicPrescription(
    organizationId: string,
    event: ReturnType<typeof satelliteClinicPrescriptionIssuedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    this.logger.log(
      `Clinic prescription issued visit=${event.payload.visitId} lines=${event.payload.lines.length}`,
    );
    return {
      meta: {
        visitId: event.payload.visitId,
        patientRef: event.payload.patientRef,
        lineCount: event.payload.lines.length,
        patientOrigin: event.payload.patientOrigin,
      },
    };
  }

  private async handleClinicWardDayCharge(
    organizationId: string,
    event: ReturnType<typeof satelliteClinicWardDayChargeSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(organizationId);
    const amount = event.payload.amountNet;
    const transactionId = await this.prisma.$transaction(async (tx) =>
      this.postBalancedJournal(tx, organizationId, {
        amount,
        reference: `clinic-ward:${event.payload.admissionId}:${event.payload.chargeDate}`,
        description: `Inpatient ward day ${event.payload.wardCode}/${event.payload.bedCode}`,
        counterpartyId: cpId,
      }),
    );
    let invoiceId: string | undefined;
    if (cpId) {
      invoiceId = await this.createDraftInvoice(
        organizationId,
        cpId,
        amount,
        `Ward day ${event.payload.chargeDate}`,
        event.payload.admissionId,
      );
    }
    return {
      transactionId,
      invoiceId,
      meta: {
        admissionId: event.payload.admissionId,
        chargeDate: event.payload.chargeDate,
      },
    };
  }

  private async handleHotelGuestLifecycle(
    organizationId: string,
    event: {
      correlationId: string;
      payload: { reservationId: string; programCode?: string };
    },
    kind: "checked_in" | "checked_out" | "room_changed",
  ): Promise<SatelliteDispatchResult> {
    this.logger.log(
      `Hotel guest lifecycle ${kind} reservation=${event.payload.reservationId} program=${event.payload.programCode ?? "—"}`,
    );
    return {
      meta: {
        kind,
        reservationId: event.payload.reservationId,
        programCode: event.payload.programCode,
        organizationId,
      },
    };
  }

  private async handleFbStockConsumption(
    organizationId: string,
    event: ReturnType<typeof satelliteFbStockConsumptionCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const cpId = await this.resolveCounterpartyId(organizationId);
    const cogsAmount = event.payload.lines.reduce(
      (sum, line) => sum + line.qty,
      0,
    );
    const amount = Math.max(event.payload.amountAzn, cogsAmount);
    const transactionId = await this.prisma.$transaction(async (tx) => {
      const [wipDefault, cogsDefault] = await Promise.all([
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_WIP", "WIP_MANUFACTURING", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_COGS", "COGS", tx),
      ]);
      return this.postBalancedJournal(tx, organizationId, {
        amount,
        reference: `fb-consumption:${event.payload.ticketId}`,
        description: `F&B stock consumption ${event.payload.outletCode ?? event.payload.outletId} (${event.correlationId})`,
        counterpartyId: cpId,
        debitAccount: wipDefault,
        creditAccount: cogsDefault,
      });
    });
    return {
      transactionId,
      meta: {
        ticketId: event.payload.ticketId,
        outletId: event.payload.outletId,
        lineCount: event.payload.lines.length,
      },
    };
  }

  private async handleBankGlDailySummary(
    organizationId: string,
    event: ReturnType<typeof satelliteBankGlDailySummarySchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const ref = `BANK-GL-SUMMARY-${event.payload.businessDate}`;
    const existing = await this.prisma.transaction.findFirst({
      where: { organizationId, reference: ref },
      select: { id: true },
    });
    if (existing) {
      return { transactionId: existing.id, meta: { idempotent: true } };
    }

    const lines: PostTransactionLine[] = event.payload.lines
      .filter((l) => l.debit > 0 || l.credit > 0)
      .map((l) => ({
        accountCode: l.glCode,
        debit: l.debit,
        credit: l.credit,
      }));

    if (lines.length === 0) {
      return { meta: { skipped: true, reason: "empty_lines" } };
    }

    this.accounting.validateBalance(lines);

    const { transactionId } = await this.prisma.$transaction(async (tx) => {
      const posted = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: new Date(`${event.payload.businessDate}T12:00:00.000Z`),
        reference: ref,
        description: `Bank CBS GL daily summary ${event.payload.businessDate}`,
        ledgerType: LedgerType.NAS,
        lines,
      });
      return posted;
    });

    return {
      transactionId,
      meta: { businessDate: event.payload.businessDate, lineCount: lines.length },
    };
  }
}
