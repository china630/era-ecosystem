/** Result returned by accounting adapters after dispatching satellite revenue. */
export type AccountingDispatchResult = {
  transactionId?: string;
  invoiceId?: string;
  meta?: Record<string, unknown>;
};

/** Pluggable accounting surface for satellite revenue / invoice ingress. */
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

  recordMetaOnly(meta: Record<string, unknown>): AccountingDispatchResult;
}
