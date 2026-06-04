export type NetworkDocumentPayload = {
  correlationId: string;
  issuerOrganizationId: string;
  recipientOrganizationId: string;
  sourceInvoiceId: string;
  currency: string;
  totalNet: string;
  vatAmount: string;
  totalGross: string;
  lines: unknown;
  issuerInvoiceNumber?: string | null;
  issuerTaxIdBlindIndex?: string | null;
};

export interface NetworkDocumentTransport {
  deliver(payload: NetworkDocumentPayload): Promise<void>;
}
