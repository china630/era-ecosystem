import { Injectable } from "@nestjs/common";
import { InProcessNetworkDocumentTransport } from "./transport/in-process-network-document-transport";
import type { ReceiveNetworkDocumentDto } from "./dto/receive-network-document.dto";
import type { NetworkDocumentPayload } from "./transport/network-document-transport";

@Injectable()
export class InternalNetworkDocumentsService {
  constructor(private readonly inProcess: InProcessNetworkDocumentTransport) {}

  async receive(payload: ReceiveNetworkDocumentDto) {
    const normalized: NetworkDocumentPayload = {
      correlationId: payload.correlationId,
      issuerOrganizationId: payload.issuerOrganizationId,
      recipientOrganizationId: payload.recipientOrganizationId,
      sourceInvoiceId: payload.sourceInvoiceId,
      currency: payload.currency,
      totalNet: payload.totalNet,
      vatAmount: payload.vatAmount,
      totalGross: payload.totalGross,
      lines: payload.lines,
      issuerInvoiceNumber: payload.issuerInvoiceNumber ?? null,
      issuerTaxIdBlindIndex: payload.issuerTaxIdBlindIndex ?? null,
    };
    await this.inProcess.deliver(normalized);
    return { ok: true, correlationId: payload.correlationId };
  }
}
