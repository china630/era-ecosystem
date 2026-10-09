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
  isSatelliteHotelStayProductChanged,
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
  isSatelliteFbSaleCompleted,
  isSatelliteFbShiftClosed,
  isSatelliteFbStockConsumptionCompleted,
  isSatelliteStaffClockBatch,
  isSatelliteWorkforceAbsenceApproved,
  isSatelliteWorkforceAbsenceCancelled,
  isSatelliteWorkforceAbsenceUpdated,
  isSatelliteWorkforceEmploymentTransferred,
  isSatelliteWorkforceEmploymentHired,
  isSatelliteWorkforceEmploymentTerminated,
  isSatelliteWorkforceOrgUnitArchived,
  isSatelliteWorkforceOrgUnitUpserted,
  isSatelliteWorkforcePositionUpserted,
  isSatelliteWorkforceTimesheetApproved,
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
import {
  HotelDayDocumentStatus,
  LedgerType,
  Prisma,
  StockMovementReason,
  StockMovementType,
  type PostingRole,
} from "@erafinance/database";
import { departmentFinanceEventsSilenced } from "@era/satellite-kit";
import {
  AccountingService,
  type PostTransactionLine,
} from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { InvoicesService } from "../invoices/invoices.service";
import { CounterpartiesService } from "../counterparties/counterparties.service";
import { TimesheetService } from "../hr/timesheet.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { WorkforceAbsenceSyncService } from "./workforce-absence-sync.service";
import { WorkforceOrgSyncService } from "./workforce-org-sync.service";
import { WorkforceEmploymentSyncService } from "./workforce-employment-sync.service";
import { WorkforceTimesheetSyncService } from "./workforce-timesheet-sync.service";
import { blindIndex, normalizeVoen } from "../security/pii-crypto.util";

function dayDocumentTender(method: string): string {
  const key = method.trim().toUpperCase();
  if (key === "CARD") return "card";
  if (key === "DEPOSIT") return "deposit";
  if (key === "COMPANY_ACCOUNT" || key === "CITY_LEDGER" || key === "CITY") return "city";
  if (key === "BANK_TRANSFER" || key === "BANK") return "bank";
  if (key === "LOYALTY_POINTS" || key === "LOYALTY") return "loyalty";
  if (key === "CASH") return "cash";
  throw new Error(`Unknown day-document tender ${method}`);
}

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
    private readonly workforceAbsenceSync: WorkforceAbsenceSyncService,
    private readonly workforceOrgSync: WorkforceOrgSyncService,
    private readonly workforceEmploymentSync: WorkforceEmploymentSyncService,
    private readonly workforceTimesheetSync: WorkforceTimesheetSyncService,
    private readonly counterparties: CounterpartiesService,
    private readonly inventory: InventoryService,
  ) {}

  private async defaultOpsBookId(
    organizationId: string,
  ): Promise<string | null> {
    const book = await this.prisma.accountingBook.findFirst({
      where: {
        organizationId,
        isDefaultOps: true,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    return book?.id ?? null;
  }

  async dispatch(
    organizationId: string,
    data: unknown,
  ): Promise<SatelliteDispatchResult> {
    if (isSatelliteWorkforceAbsenceApproved(data)) {
      return this.workforceAbsenceSync.handleApproved(organizationId, data);
    }
    if (isSatelliteWorkforceAbsenceUpdated(data)) {
      return this.workforceAbsenceSync.handleUpdated(organizationId, data);
    }
    if (isSatelliteWorkforceAbsenceCancelled(data)) {
      return this.workforceAbsenceSync.handleCancelled(organizationId, data);
    }
    if (isSatelliteWorkforceOrgUnitUpserted(data)) {
      return this.workforceOrgSync.handleOrgUnitUpserted(organizationId, data);
    }
    if (isSatelliteWorkforceOrgUnitArchived(data)) {
      return this.workforceOrgSync.handleOrgUnitArchived(organizationId, data);
    }
    if (isSatelliteWorkforcePositionUpserted(data)) {
      return this.workforceOrgSync.handlePositionUpserted(organizationId, data);
    }
    if (isSatelliteWorkforceEmploymentTransferred(data)) {
      return this.workforceOrgSync.handleEmploymentTransferred(organizationId, data);
    }
    if (isSatelliteWorkforceEmploymentHired(data)) {
      return this.workforceEmploymentSync.handleHired(organizationId, data);
    }
    if (isSatelliteWorkforceEmploymentTerminated(data)) {
      return this.workforceEmploymentSync.handleTerminated(organizationId, data);
    }
    if (isSatelliteWorkforceTimesheetApproved(data)) {
      return this.workforceTimesheetSync.handleApproved(organizationId, data);
    }
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
    if (isSatelliteHotelStayProductChanged(data)) {
      return { meta: { skipped: true, reason: "clinic_lifecycle" } };
    }
    if (isSatelliteFbSaleCompleted(data) || isSatelliteFbShiftClosed(data)) {
      if (await this.departmentRevenueSilenced(organizationId)) {
        return { meta: { skipped: true, reason: "day document" } };
      }
    }
    throw new Error("Unhandled satellite event type");
  }

  private async departmentRevenueSilenced(organizationId: string): Promise<boolean> {
    return departmentFinanceEventsSilenced(organizationId);
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
      accountingBookId: await this.defaultOpsBookId(organizationId),
      lines,
    });
    return transactionId;
  }

  private dueDateIso(days = 30): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private async resolvePaymentTermsDays(
    organizationId: string,
    counterpartyId: string | null | undefined,
  ): Promise<number> {
    if (!counterpartyId) return 30;
    const row = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId },
      select: { paymentTermsDays: true },
    });
    const days = row?.paymentTermsDays;
    return typeof days === "number" && days >= 0 ? days : 30;
  }

  private async createDraftInvoice(
    organizationId: string,
    counterpartyId: string,
    amount: number,
    description: string,
    reference: string,
  ): Promise<string> {
    const terms = await this.resolvePaymentTermsDays(organizationId, counterpartyId);
    const inv = await this.invoices.create(organizationId, {
      counterpartyId,
      dueDate: this.dueDateIso(terms),
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
    const taxId = event.payload.counterpartyTaxId;
    if (!taxId) {
      this.logger.warn(
        `Hotel invoice ${event.payload.invoiceNumber}: missing counterpartyTaxId; skipping invoice`,
      );
      return {
        meta: {
          folioId: event.payload.folioId,
          skipped: true,
          reason: "missing counterpartyTaxId",
        },
      };
    }

    const normalized = normalizeVoen(taxId);
    const taxIdBlindIndex = blindIndex("voen", normalized);
    const cp = await this.prisma.counterparty.findFirst({
      where: { organizationId, taxIdBlindIndex, deletedAt: null },
      select: { id: true },
    });

    if (!cp?.id) {
      // Fail-fast: hotel checkout gate should already block by default,
      // but if this happens for a retry stream, we want the event to retry.
      throw new Error(`No Finance counterparty for VOEN=${taxId}`);
    }

    const counterpartyId = cp.id;

    // Idempotency: retries + re-emits may come with different invoiceNumber.
    // We dedupe by hotel folio id.
    const sourceFolioId = event.payload.folioId;
    const existing = await this.prisma.invoice.findFirst({
      where: { organizationId, sourceFolioId },
      select: { id: true },
    });
    if (existing) {
      return {
        invoiceId: existing.id,
        meta: {
          folioId: event.payload.folioId,
          invoiceNumber: event.payload.invoiceNumber,
          total,
          paymentTermsDays: await this.resolvePaymentTermsDays(organizationId, counterpartyId),
          deduped: true,
        },
      };
    }

    const terms = await this.resolvePaymentTermsDays(organizationId, counterpartyId);
    const issue = new Date(`${event.payload.issueDate}T00:00:00.000Z`);
    issue.setUTCDate(issue.getUTCDate() + terms);
    const dueDate = issue.toISOString().slice(0, 10);
    const invoiceRow = await this.invoices.create(organizationId, {
      counterpartyId,
      dueDate,
      items: event.payload.lines.map((line: { description: string; qty: number; amount: number; vatRate?: number }) => ({
        description: `${line.description} (${event.payload.invoiceNumber})`,
        quantity: line.qty,
        unitPrice: line.amount,
        vatRate: line.vatRate ?? 18,
      })),
      currency: "AZN",
      vatInclusive: false,
    });

    try {
      await this.prisma.invoice.update({
        where: { id: invoiceRow.id },
        data: { sourceFolioId },
      });
    } catch (e) {
      // If uniqueness raced, fall back to re-fetch and return existing.
      const raced = await this.prisma.invoice.findFirst({
        where: { organizationId, sourceFolioId },
        select: { id: true },
      });
      if (raced?.id) {
        return {
          invoiceId: raced.id,
          meta: { folioId: event.payload.folioId, invoiceNumber: event.payload.invoiceNumber, total, paymentTermsDays: terms, deduped: true },
        };
      }
      throw e;
    }
    return {
      invoiceId: invoiceRow.id,
      meta: {
        folioId: event.payload.folioId,
        invoiceNumber: event.payload.invoiceNumber,
        total,
        paymentTermsDays: terms,
        revenuePosted: false,
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
        revenuePosted: false,
        reconciliationNote: `Hotel agency ${event.payload.agencyCode} balance ${event.payload.balance} AZN on ${event.payload.asOfDate}`,
      },
    };
  }

  private async handleHotelReservation(
    organizationId: string,
    event: ReturnType<typeof satelliteHotelReservationCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    this.logger.log(
      `Hotel reservation ${event.payload.reservationId} skipped revenue posting (${organizationId})`,
    );
    return {
      meta: {
        reservationId: event.payload.reservationId,
        skipped: true,
        reason: "revenue is the day document",
      },
    };
  }

  async listRejectedHotelDayDocuments(organizationId: string) {
    return this.prisma.hotelDayDocument.findMany({
      where: { organizationId, status: HotelDayDocumentStatus.REJECTED },
      orderBy: { businessDate: "desc" },
      select: {
        id: true,
        businessDate: true,
        reference: true,
        errorMessage: true,
        updatedAt: true,
      },
    });
  }

  postHotelNightAuditEvent(
    organizationId: string,
    event: ReturnType<typeof satelliteHotelNightAuditClosedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    return this.handleHotelNightAudit(organizationId, event);
  }

  async acceptHotelDayDocument(organizationId: string, id: string): Promise<SatelliteDispatchResult> {
    const row = await this.prisma.hotelDayDocument.findFirst({
      where: { id, organizationId, status: HotelDayDocumentStatus.REJECTED },
    });
    if (!row) throw new Error("Rejected day document was not found");
    const event = satelliteHotelNightAuditClosedSchema.parse(row.payloadJson);
    return this.handleHotelNightAudit(organizationId, event);
  }

  private async handleHotelNightAudit(
    organizationId: string,
    event: ReturnType<typeof satelliteHotelNightAuditClosedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    const reference = `hotel-na:${event.payload.businessDate}`;
    const claim = await this.claimHotelDayDocument(organizationId, reference, event);
    if (claim === "posted") {
      const existing = await this.prisma.transaction.findFirst({
        where: { organizationId, reference },
        select: { id: true },
      });
      return {
        transactionId: existing?.id,
        meta: { businessDate: event.payload.businessDate, idempotent: true },
      };
    }
    if (claim === "wait") {
      const settled = await this.waitHotelDayDocument(organizationId, reference);
      if (settled) return settled;
      return {
        meta: {
          businessDate: event.payload.businessDate,
          rejected: true,
          error: "Finance is still posting the day document",
        },
      };
    }

    try {
      const posted = await this.prisma.$transaction(async (tx) => {
        const already = await tx.transaction.findFirst({
          where: { organizationId, reference },
          select: { id: true },
        });
        if (already) return { transactionId: already.id, stockMoves: 0, saleTotal: 0 };
        const built = await this.buildHotelDayDocument(tx, organizationId, event);
        if (built.lines.length === 0 && built.stockMoves === 0) return null;
        const debit = built.lines.reduce((sum, line) => sum + Number(line.debit), 0);
        const credit = built.lines.reduce((sum, line) => sum + Number(line.credit), 0);
        if (built.lines.length > 0 && Math.abs(debit - credit) > 0.01) {
          throw new Error("Night audit journal is not balanced");
        }
        if (built.lines.length === 0) return { stockMoves: built.stockMoves };
        const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
          organizationId,
          date: new Date(`${event.payload.businessDate}T12:00:00.000Z`),
          reference,
          description: `Hotel night audit ${event.payload.businessDate} (${event.correlationId})`,
          ledgerType: LedgerType.NAS,
          accountingBookId: await this.defaultOpsBookId(organizationId),
          lines: built.lines,
        });
        return { transactionId, stockMoves: built.stockMoves, saleTotal: built.saleTotal };
      });
      await this.prisma.hotelDayDocument.update({
        where: { organizationId_reference: { organizationId, reference } },
        data: {
          status: HotelDayDocumentStatus.POSTED,
          errorMessage: null,
          transactionId: posted && "transactionId" in posted ? posted.transactionId : null,
        },
      });
      if (!posted) {
        return {
          meta: {
            businessDate: event.payload.businessDate,
            nightAuditId: event.payload.nightAuditId,
            skipped: true,
            reason: "empty day",
          },
        };
      }
      return {
        transactionId: "transactionId" in posted ? posted.transactionId : undefined,
        meta: {
          businessDate: event.payload.businessDate,
          nightAuditId: event.payload.nightAuditId,
          stockMoves: posted.stockMoves,
          saleTotal: "saleTotal" in posted ? posted.saleTotal : 0,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Day document rejected";
      await this.prisma.hotelDayDocument.update({
        where: { organizationId_reference: { organizationId, reference } },
        data: { status: HotelDayDocumentStatus.REJECTED, errorMessage: message },
      });
      return {
        meta: {
          businessDate: event.payload.businessDate,
          nightAuditId: event.payload.nightAuditId,
          rejected: true,
          error: message,
        },
      };
    }
  }

  private async claimHotelDayDocument(
    organizationId: string,
    reference: string,
    event: ReturnType<typeof satelliteHotelNightAuditClosedSchema.parse>,
  ): Promise<"run" | "posted" | "wait"> {
    const existing = await this.prisma.transaction.findFirst({
      where: { organizationId, reference },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.hotelDayDocument.upsert({
        where: { organizationId_reference: { organizationId, reference } },
        create: {
          organizationId,
          businessDate: event.payload.businessDate,
          reference,
          status: HotelDayDocumentStatus.POSTED,
          payloadJson: event as Prisma.InputJsonValue,
          transactionId: existing.id,
        },
        update: { status: HotelDayDocumentStatus.POSTED, errorMessage: null, transactionId: existing.id },
      });
      return "posted";
    }
    const row = await this.prisma.hotelDayDocument.findUnique({
      where: { organizationId_reference: { organizationId, reference } },
    });
    if (row?.status === HotelDayDocumentStatus.POSTED) return "posted";
    if (row?.status === HotelDayDocumentStatus.POSTING) return "wait";
    if (!row) {
      try {
        await this.prisma.hotelDayDocument.create({
          data: {
            organizationId,
            businessDate: event.payload.businessDate,
            reference,
            status: HotelDayDocumentStatus.POSTING,
            payloadJson: event as Prisma.InputJsonValue,
          },
        });
        return "run";
      } catch {
        return "wait";
      }
    }
    const taken = await this.prisma.hotelDayDocument.updateMany({
      where: { id: row.id, status: HotelDayDocumentStatus.REJECTED },
      data: {
        status: HotelDayDocumentStatus.POSTING,
        errorMessage: null,
        payloadJson: event as Prisma.InputJsonValue,
      },
    });
    return taken.count === 1 ? "run" : "wait";
  }

  private async waitHotelDayDocument(
    organizationId: string,
    reference: string,
  ): Promise<SatelliteDispatchResult | null> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const row = await this.prisma.hotelDayDocument.findUnique({
        where: { organizationId_reference: { organizationId, reference } },
      });
      if (!row || row.status === HotelDayDocumentStatus.POSTING) continue;
      if (row.status === HotelDayDocumentStatus.POSTED) {
        return {
          transactionId: row.transactionId ?? undefined,
          meta: { businessDate: row.businessDate, idempotent: true },
        };
      }
      return {
        meta: {
          businessDate: row.businessDate,
          rejected: true,
          error: row.errorMessage ?? "Day document rejected",
        },
      };
    }
    return null;
  }

  private async buildHotelDayDocument(
    tx: Prisma.TransactionClient,
    organizationId: string,
    event: ReturnType<typeof satelliteHotelNightAuditClosedSchema.parse>,
  ): Promise<{ lines: PostTransactionLine[]; stockMoves: number; saleTotal: number }> {
    const money = (value: number) => Math.round(value * 100) / 100;
    const saleLines = event.payload.saleLines ?? [];
    const revenueLines = event.payload.revenueLines;
    for (const line of saleLines) {
      if (line.qty === 0 && line.amount === 0) continue;
      const product = await tx.product.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          sku: { equals: line.sku, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (!product) throw new Error(`SKU not in the hotel catalog: ${line.sku}`);
    }
    const saleTotal = money(
      saleLines.reduce((sum, line) => sum + line.amount, 0) +
        revenueLines.reduce((sum, line) => sum + line.amount, 0),
    );

    const [cash, card, deposit, city, bank, loyalty, receivable, advance, cogs] =
      await Promise.all([
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_CASH_AZN", "CASH_AZN", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_CARD", "BANK_SETTLEMENT", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_DEPOSIT", "PREPAID_ASSET", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_CITY_LEDGER", "TRADE_RECEIVABLE_SERVICES", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_BANK", "MAIN_BANK", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_LOYALTY", "PREPAID_ASSET", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_RECEIVABLE", "TRADE_RECEIVABLE", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_ADVANCE", "PREPAID_ASSET", tx),
        this.satelliteGlAccount(organizationId, "SATELLITE_GL_COGS", "COGS", tx),
      ]);

    const creditByAccount = new Map<string, number>();
    const addRevenue = (accountCode: string, amount: number, label: string) => {
      if (amount === 0) return;
      const account = accountCode.trim();
      if (!account) throw new Error(`Revenue account missing for ${label}`);
      creditByAccount.set(account, money((creditByAccount.get(account) ?? 0) + amount));
    };
    for (const line of saleLines) {
      if (line.amount === 0) continue;
      const product = await tx.product.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          sku: { equals: line.sku, mode: "insensitive" },
        },
        select: { revenueAccountCode: true },
      });
      addRevenue(product?.revenueAccountCode ?? "", line.amount, `sku ${line.sku}`);
    }
    for (const line of revenueLines) {
      addRevenue(line.glAccountCode, line.amount, `revenue code ${line.revenueCode}`);
    }

    const tenderAccount: Record<string, string> = {
      cash,
      card,
      deposit,
      city,
      bank,
      loyalty,
    };
    const tenderByBucket = new Map<string, number>();
    for (const line of event.payload.paymentLines) {
      const bucket = dayDocumentTender(line.method);
      tenderByBucket.set(bucket, money((tenderByBucket.get(bucket) ?? 0) + line.amount));
    }
    const tenderTotal = money([...tenderByBucket.values()].reduce((sum, amount) => sum + amount, 0));
    const gap = money(saleTotal - tenderTotal);
    const ar = gap > 0 ? gap : 0;
    const advanceAmount = gap < 0 ? -gap : 0;

    const lines: PostTransactionLine[] = [];
    const push = (accountCode: string, debit: number, credit: number) => {
      const debitAmount = money(debit);
      const creditAmount = money(credit);
      if (debitAmount === 0 && creditAmount === 0) return;
      lines.push({ accountCode, debit: debitAmount, credit: creditAmount });
    };
    for (const [accountCode, signedCredit] of creditByAccount) {
      if (signedCredit > 0) push(accountCode, 0, signedCredit);
      else if (signedCredit < 0) push(accountCode, -signedCredit, 0);
    }
    for (const [bucket, signed] of tenderByBucket) {
      const accountCode = tenderAccount[bucket];
      if (!accountCode) throw new Error(`Unknown day-document tender ${bucket}`);
      if (signed > 0) push(accountCode, signed, 0);
      else if (signed < 0) push(accountCode, 0, -signed);
    }
    if (ar > 0) push(receivable, ar, 0);
    if (advanceAmount > 0) push(advance, 0, advanceAmount);

    const stockMoves = await this.explodeDayDocumentRecipes(tx, organizationId, {
      businessDate: event.payload.businessDate,
      saleLines,
      cogsAccount: cogs,
      lines,
    });
    return { lines, stockMoves, saleTotal };
  }

  private async explodeDayDocumentRecipes(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: {
      businessDate: string;
      saleLines: Array<{ sku: string; qty: number; amount: number }>;
      cogsAccount: string;
      lines: PostTransactionLine[];
    },
  ): Promise<number> {
    const active = input.saleLines.filter((line) => line.qty !== 0);
    if (active.length === 0) return 0;
    const notePrefix = `hotel-na:${input.businessDate}`;
    const already = await tx.stockMovement.findFirst({
      where: { organizationId, note: { startsWith: notePrefix } },
      select: { id: true },
    });
    if (already) return 0;

    const warehouseId = await this.inventory.resolveDefaultWarehouseId(organizationId);
    const planned: Array<{ productId: string; signed: Prisma.Decimal; sku: string }> = [];
    for (const line of active) {
      const product = await tx.product.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          sku: { equals: line.sku, mode: "insensitive" },
        },
        select: { id: true, isService: true },
      });
      if (!product) continue;
      const recipe = await tx.productRecipe.findFirst({
        where: { organizationId, finishedProductId: product.id, deletedAt: null },
        include: {
          lines: {
            where: { deletedAt: null },
            include: { component: { select: { id: true, isService: true } } },
          },
        },
      });
      if (recipe) {
        for (const componentLine of recipe.lines) {
          if (componentLine.component.isService) continue;
          const perUnit =
            Number(componentLine.quantityPerUnit) * (1 + Number(componentLine.wasteFactor));
          const componentQty = line.qty * perUnit;
          if (Math.abs(componentQty) < 0.0000001) continue;
          planned.push({
            productId: componentLine.component.id,
            signed: new Prisma.Decimal(componentQty),
            sku: line.sku,
          });
        }
        continue;
      }
      if (!product.isService) {
        planned.push({
          productId: product.id,
          signed: new Prisma.Decimal(line.qty),
          sku: line.sku,
        });
      }
    }
    if (planned.length === 0) return 0;
    if (!warehouseId) {
      throw new Error("Hotel warehouse is required to write off the day document");
    }
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
      select: { inventoryAccountCode: true },
    });
    const inventoryAccount =
      warehouse?.inventoryAccountCode?.trim() ||
      (await this.satelliteGlAccount(organizationId, "SATELLITE_GL_INVENTORY", "INVENTORY_GOODS", tx));

    let moves = 0;
    for (const move of planned) {
      const signed = move.signed;
      const existing = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId,
            productId: move.productId,
          },
        },
      });
      const onHand = existing?.quantity ?? new Prisma.Decimal(0);
      const averageCost = existing?.averageCost ?? new Prisma.Decimal(0);
      const nextQty = onHand.minus(signed);
      await tx.stockItem.upsert({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId,
            productId: move.productId,
          },
        },
        create: {
          organizationId,
          warehouseId,
          productId: move.productId,
          quantity: nextQty,
          averageCost,
        },
        update: { quantity: nextQty },
      });
      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId,
          productId: move.productId,
          type: signed.gt(0) ? StockMovementType.OUT : StockMovementType.IN,
          reason: StockMovementReason.SALE,
          quantity: signed.abs(),
          price: averageCost,
          note: `${notePrefix}:${move.sku}`,
          documentDate: new Date(`${input.businessDate}T12:00:00.000Z`),
        },
      });
      const cost = signed.abs().mul(averageCost);
      if (cost.gt(0)) {
        const amount = cost.toNumber();
        if (signed.gt(0)) {
          input.lines.push({ accountCode: input.cogsAccount, debit: amount, credit: 0 });
          input.lines.push({ accountCode: inventoryAccount, debit: 0, credit: amount });
        } else {
          input.lines.push({ accountCode: inventoryAccount, debit: amount, credit: 0 });
          input.lines.push({ accountCode: input.cogsAccount, debit: 0, credit: amount });
        }
      }
      moves += 1;
    }
    return moves;
  }

  private async handleRetailSale(
    organizationId: string,
    event: ReturnType<typeof satelliteRetailSaleCompletedSchema.parse>,
  ): Promise<SatelliteDispatchResult> {
    if (await this.departmentRevenueSilenced(organizationId)) {
      return { meta: { skipped: true, reason: "day document", receiptId: event.payload.receiptId } };
    }
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
    let cpId = await this.resolveCounterpartyId(
      organizationId,
      event.payload.counterpartyId,
    );

    if (!cpId) {
      const partyKind = event.payload.partyKind
        ?? (event.payload.taxId ? "LEGAL_ENTITY" : "INDIVIDUAL");

      if (partyKind === "LEGAL_ENTITY" && event.payload.taxId) {
        const cp = await this.counterparties.findOrCreateByVoen({
          organizationId,
          taxId: event.payload.taxId,
          nameFallback: event.payload.companyName?.trim() || event.payload.taxId,
          legalAddressFallback: null,
        });
        cpId = cp.id;
      } else if (partyKind === "INDIVIDUAL") {
        const cp = await this.counterparties.findOrCreateIndividualForCrm({
          organizationId,
          nameFallback:
            event.payload.companyName?.trim()
            || event.payload.contactPhone
            || `CRM lead ${event.payload.leadId.slice(0, 8)}`,
          contactPhone: event.payload.contactPhone,
          contactEmail: event.payload.contactEmail,
          globalPersonId: event.payload.globalPersonId,
        });
        cpId = cp.id;
      }
    }

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
    if (await this.departmentRevenueSilenced(organizationId)) {
      return { meta: { skipped: true, reason: "day document", visitId: event.payload.visitId } };
    }
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
    if (await this.departmentRevenueSilenced(organizationId)) {
      return { meta: { skipped: true, reason: "day document", labOrderId: event.payload.labOrderId } };
    }
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
    if (await this.departmentRevenueSilenced(organizationId)) {
      return {
        meta: {
          skipped: true,
          reason: "day document",
          procedureCode: event.payload.procedureCode,
        },
      };
    }
    const ttk = await this.writeOffClinicProcedureConsumables(
      organizationId,
      event,
    );

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
          ttk,
        },
      };
    }
    const cpId = await this.resolveCounterpartyId(organizationId);
    const amount = event.payload.amountNet;
    const transactionId = await this.prisma.$transaction(async (tx) => {
      return this.postBalancedJournal(tx, organizationId, {
        amount,
        reference: `clinic-procedure:${event.payload.procedureCode}:${event.correlationId}`,
        description: `Clinic procedure completed (${event.correlationId})`,
        counterpartyId: cpId,
      });
    });
    return {
      transactionId,
      meta: {
        procedureCode: event.payload.procedureCode,
        lineCount: event.payload.lines.length,
        ttk,
      },
    };
  }

  /**
   * CLI-47: write off procedure TTK to Finance warehouse (warn+post).
   * Empty lines → no-op. Unknown SKU / missing warehouse → warn, skip line.
   */
  private async writeOffClinicProcedureConsumables(
    organizationId: string,
    event: ReturnType<typeof satelliteClinicProcedureCompletedSchema.parse>,
  ): Promise<{
    writtenOff: number;
    skipped: number;
    warnings: string[];
    warehouseId: string | null;
  }> {
    const warnings: string[] = [];
    const lines = event.payload.lines ?? [];
    if (lines.length === 0) {
      return { writtenOff: 0, skipped: 0, warnings, warehouseId: null };
    }

    const warehouseId = await this.inventory.resolveDefaultWarehouseId(organizationId);
    if (!warehouseId) {
      warnings.push("No default warehouse — TTK write-off skipped");
      this.logger.warn(
        `Clinic TTK skip (no warehouse) org=${organizationId} corr=${event.correlationId}`,
      );
      return { writtenOff: 0, skipped: lines.length, warnings, warehouseId: null };
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
      select: { inventoryAccountCode: true },
    });
    if (!warehouse?.inventoryAccountCode) {
      warnings.push("Warehouse missing inventory account — TTK write-off skipped");
      this.logger.warn(
        `Clinic TTK skip (no inventory account) org=${organizationId} corr=${event.correlationId}`,
      );
      return { writtenOff: 0, skipped: lines.length, warnings, warehouseId };
    }
    const inventoryAccountCode = warehouse.inventoryAccountCode;
    if (inventoryAccountCode !== "201" && inventoryAccountCode !== "204") {
      warnings.push(
        `Warehouse inventory account ${inventoryAccountCode} is not a stock account — TTK write-off skipped`,
      );
      this.logger.warn(
        `Clinic TTK skip (inventory account ${inventoryAccountCode}) org=${organizationId} corr=${event.correlationId}`,
      );
      return { writtenOff: 0, skipped: lines.length, warnings, warehouseId };
    }

    let writtenOff = 0;
    let skipped = 0;
    for (const line of lines) {
      const sku = line.sku?.trim();
      if (!sku || !(line.qty > 0)) {
        skipped += 1;
        warnings.push(`Invalid line skipped: sku=${line.sku} qty=${line.qty}`);
        continue;
      }
      const product = await this.prisma.product.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          isService: false,
          sku: { equals: sku, mode: "insensitive" },
        },
      });
      if (!product) {
        skipped += 1;
        warnings.push(`Unknown SKU ${sku}`);
        this.logger.warn(
          `Clinic TTK unknown SKU=${sku} corr=${event.correlationId}`,
        );
        continue;
      }
      try {
        await this.inventory.adjustStock(organizationId, {
          warehouseId,
          productId: product.id,
          quantity: line.qty,
          type: "OUT",
          inventoryAccountCode,
          forceAllowNegative: true,
        });
        writtenOff += 1;
      } catch (err) {
        skipped += 1;
        const msg = err instanceof Error ? err.message : "write-off failed";
        warnings.push(`SKU ${sku}: ${msg}`);
        this.logger.warn(
          `Clinic TTK write-off failed sku=${sku} corr=${event.correlationId}: ${msg}`,
        );
      }
    }

    return { writtenOff, skipped, warnings, warehouseId };
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
    if (await this.departmentRevenueSilenced(organizationId)) {
      return {
        meta: {
          skipped: true,
          reason: "day document",
          admissionId: event.payload.admissionId,
        },
      };
    }
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
    if (await this.departmentRevenueSilenced(organizationId)) {
      return { meta: { skipped: true, reason: "day document", ticketId: event.payload.ticketId } };
    }
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
        accountingBookId: await this.defaultOpsBookId(organizationId),
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
