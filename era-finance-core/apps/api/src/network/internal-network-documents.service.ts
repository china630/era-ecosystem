import { Injectable } from "@nestjs/common";
import { InProcessNetworkDocumentTransport } from "./transport/in-process-network-document-transport";
import type { NetworkDocumentPayload } from "./transport/network-document-transport";

@Injectable()
export class InternalNetworkDocumentsService {
  constructor(private readonly inProcess: InProcessNetworkDocumentTransport) {}

  async receive(payload: NetworkDocumentPayload) {
    await this.inProcess.deliver(payload);
    return { ok: true, correlationId: payload.correlationId };
  }
}
