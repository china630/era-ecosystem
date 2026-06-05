import { Injectable } from "@nestjs/common";
import { NetworkDocumentStatus } from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  NetworkDocumentPayload,
  NetworkDocumentTransport,
} from "./network-document-transport";

@Injectable()
export class InProcessNetworkDocumentTransport implements NetworkDocumentTransport {
  constructor(private readonly prisma: PrismaService) {}

  async deliver(payload: NetworkDocumentPayload): Promise<void> {
    await this.prisma.networkDocument.upsert({
      where: {
        correlationId_recipientOrganizationId: {
          correlationId: payload.correlationId,
          recipientOrganizationId: payload.recipientOrganizationId,
        },
      },
      create: {
        correlationId: payload.correlationId,
        issuerOrganizationId: payload.issuerOrganizationId,
        recipientOrganizationId: payload.recipientOrganizationId,
        sourceInvoiceId: payload.sourceInvoiceId,
        status: NetworkDocumentStatus.PENDING_REVIEW,
        currency: payload.currency,
        totalNet: payload.totalNet,
        vatAmount: payload.vatAmount,
        totalGross: payload.totalGross,
        lines: payload.lines as object,
        issuerInvoiceNumber: payload.issuerInvoiceNumber ?? null,
        issuerTaxIdBlindIndex: payload.issuerTaxIdBlindIndex ?? null,
      },
      update: {
        issuerInvoiceNumber: payload.issuerInvoiceNumber ?? null,
        issuerTaxIdBlindIndex: payload.issuerTaxIdBlindIndex ?? null,
        totalNet: payload.totalNet,
        vatAmount: payload.vatAmount,
        totalGross: payload.totalGross,
        lines: payload.lines as object,
        currency: payload.currency,
        status: NetworkDocumentStatus.PENDING_REVIEW,
        rejectReason: null,
      },
    });
  }
}
