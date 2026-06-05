import type { Prisma } from "@erafinance/database";
import type { SatelliteDispatchResult } from "./satellite-event-dispatch.service";

/** Pluggable accounting surface for satellite ingress (default: Finance GL). */
export interface AccountingAdapter {
  postBalancedRevenue(input: {
    organizationId: string;
    amount: number;
    reference: string;
    description: string;
    counterpartyId?: string | null;
    debitAccount?: string;
    creditAccount?: string;
  }): Promise<{ transactionId: string }>;

  postConsumptionCogs(input: {
    organizationId: string;
    amount: number;
    reference: string;
    description: string;
    counterpartyId?: string | null;
  }): Promise<{ transactionId: string }>;

  createDraftInvoiceForEvent(input: {
    organizationId: string;
    counterpartyId: string;
    amount: number;
    description: string;
    sourceId: string;
  }): Promise<string | undefined>;

  recordMetaOnly(meta: Record<string, unknown>): SatelliteDispatchResult;
}

export type AccountingTx = Prisma.TransactionClient;
