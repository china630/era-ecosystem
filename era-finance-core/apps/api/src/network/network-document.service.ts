import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NetworkDocumentStatus,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { NetworkDocumentPostingService } from "./network-document-posting.service";
import { NetworkTenantMatchService } from "./network-tenant-match.service";
import {
  parseNetworkDocumentsSettings,
  type NetworkInboundDebitRole,
} from "./network-settings.util";
import type { NetworkDocumentTransport } from "./transport/network-document-transport";
import { NetworkEqaimePrefillService } from "./network-eqaime-prefill.service";
import { InProcessNetworkDocumentTransport } from "./transport/in-process-network-document-transport";
import { OrchestratorNetworkDocumentTransport } from "./transport/orchestrator-network-document-transport";

const Decimal = Prisma.Decimal;

function amountsFromInvoiceItems(
  items: Array<{ lineTotal: Prisma.Decimal; vatRate: Prisma.Decimal }>,
  totalGross: Prisma.Decimal,
): { totalNet: Prisma.Decimal; vatAmount: Prisma.Decimal } {
  let totalNet = new Decimal(0);
  let vatAmount = new Decimal(0);
  for (const row of items) {
    const gross = new Decimal(row.lineTotal);
    const vr = row.vatRate.toNumber();
    const pct = vr === -1 ? 0 : vr;
    const div = new Decimal(1).add(new Decimal(pct).div(100));
    const net = gross.div(div);
    totalNet = totalNet.add(net);
    vatAmount = vatAmount.add(gross.sub(net));
  }
  if (totalNet.add(vatAmount).sub(totalGross).abs().gt(new Decimal("0.01"))) {
    totalNet = totalGross.sub(vatAmount);
  }
  return { totalNet, vatAmount };
}

@Injectable()
export class NetworkDocumentService {
  private readonly logger = new Logger(NetworkDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly match: NetworkTenantMatchService,
    private readonly posting: NetworkDocumentPostingService,
    private readonly inProcessTransport: InProcessNetworkDocumentTransport,
    private readonly orchestratorTransport: OrchestratorNetworkDocumentTransport,
    private readonly config: ConfigService,
    private readonly eqaimePrefill: NetworkEqaimePrefillService,
  ) {}

  scheduleEmitFromInvoice(issuerOrgId: string, invoiceId: string): void {
    void this.emitFromInvoice(issuerOrgId, invoiceId).catch((e) => {
      this.logger.warn(
        `NetworkDocument emit failed invoice=${invoiceId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    });
  }

  async emitFromInvoice(issuerOrgId: string, invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: issuerOrgId },
      include: {
        items: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            vatRate: true,
            lineTotal: true,
            productId: true,
          },
        },
      },
    });
    if (!invoice?.revenueRecognized) return;

    const matched = await this.match.findRecipientOrgForCounterparty(
      issuerOrgId,
      invoice.counterpartyId,
    );
    if (!matched) return;

    const issuerOrg = await this.prisma.organization.findFirst({
      where: { id: issuerOrgId },
      select: { taxIdBlindIndex: true },
    });
    const issuerBlind = issuerOrg?.taxIdBlindIndex ?? null;

    const { totalNet, vatAmount } = amountsFromInvoiceItems(
      invoice.items,
      invoice.totalAmount,
    );

    const lines = invoice.items.map((i) => ({
      description: i.description,
      quantity: i.quantity.toString(),
      unitPrice: i.unitPrice.toString(),
      vatRate: i.vatRate.toString(),
      lineTotal: i.lineTotal.toString(),
      productId: i.productId,
    }));

    const correlationId = invoice.id;
    const payload = {
      correlationId,
      issuerOrganizationId: issuerOrgId,
      recipientOrganizationId: matched.recipientOrgId,
      sourceInvoiceId: invoice.id,
      currency: invoice.currency,
      totalNet: totalNet.toFixed(4),
      vatAmount: vatAmount.toFixed(4),
      totalGross: invoice.totalAmount.toFixed(4),
      lines,
      issuerInvoiceNumber: invoice.number,
      issuerTaxIdBlindIndex: issuerBlind,
    };

    await this.transport().deliver(payload);

    const recipient = await this.prisma.organization.findFirst({
      where: { id: matched.recipientOrgId },
      select: { settings: true },
    });
    const ndSettings = parseNetworkDocumentsSettings(recipient?.settings);
    const autoRole = ndSettings.autoPostSafeRoles?.find(
      (r) => r === "MISC_OPERATING_EXPENSE",
    ) as NetworkInboundDebitRole | undefined;
    if (autoRole) {
      const doc = await this.prisma.networkDocument.findFirst({
        where: {
          correlationId,
          recipientOrganizationId: matched.recipientOrgId,
          status: NetworkDocumentStatus.PENDING_REVIEW,
        },
      });
      if (doc) {
        try {
          await this.posting.acceptAndPost(matched.recipientOrgId, doc.id, {
            debitRole: autoRole,
            claimsVat: true,
          });
        } catch (e) {
          this.logger.warn(
            `NetworkDocument autoPost failed doc=${doc.id}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
    }
  }

  private transport(): NetworkDocumentTransport {
    const mode = (
      this.config.get<string>("NETWORK_DOCUMENT_TRANSPORT") ??
      process.env.NETWORK_DOCUMENT_TRANSPORT ??
      "in_process"
    )
      .trim()
      .toLowerCase();
    if (mode === "orchestrator") {
      return this.orchestratorTransport;
    }
    return this.inProcessTransport;
  }

  async setEQaimeRef(
    recipientOrgId: string,
    docId: string,
    externalId: string,
  ) {
    const doc = await this.prisma.networkDocument.findFirst({
      where: { id: docId, recipientOrganizationId: recipientOrgId },
    });
    if (!doc) throw new NotFoundException("Network document not found");
    return this.prisma.networkDocument.update({
      where: { id: doc.id },
      data: { eQaimeRef: externalId.trim() },
    });
  }

  async markSuperseded(correlationId: string): Promise<number> {
    const res = await this.prisma.networkDocument.updateMany({
      where: {
        correlationId,
        status: {
          in: [
            NetworkDocumentStatus.PENDING_REVIEW,
            NetworkDocumentStatus.ACCEPTED,
          ],
        },
      },
      data: { status: NetworkDocumentStatus.SUPERSEDED },
    });
    return res.count;
  }

  async listInbox(recipientOrgId: string) {
    const items = await this.prisma.networkDocument.findMany({
      where: {
        recipientOrganizationId: recipientOrgId,
        status: NetworkDocumentStatus.PENDING_REVIEW,
      },
      orderBy: { createdAt: "desc" },
      include: {
        issuerOrganization: { select: { name: true, taxIdCipher: true } },
      },
    });
    return {
      pendingCount: items.length,
      items: items.map((d) => ({
        id: d.id,
        correlationId: d.correlationId,
        status: d.status,
        issuerOrganizationId: d.issuerOrganizationId,
        issuerName: d.issuerOrganization.name,
        issuerInvoiceNumber: d.issuerInvoiceNumber,
        currency: d.currency,
        totalGross: d.totalGross.toFixed(4),
        totalNet: d.totalNet.toFixed(4),
        vatAmount: d.vatAmount.toFixed(4),
        eQaimeRef: d.eQaimeRef,
        eqaimeStatus: this.eqaimePrefill.compareWithEQaime(d).status,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  async getInboxDetail(recipientOrgId: string, id: string) {
    const doc = await this.prisma.networkDocument.findFirst({
      where: { id, recipientOrganizationId: recipientOrgId },
      include: {
        issuerOrganization: { select: { name: true } },
      },
    });
    if (!doc) throw new NotFoundException("Network document not found");
    const eqaimeCompare = this.eqaimePrefill.compareWithEQaime(doc);
    return {
      ...doc,
      totalGross: doc.totalGross.toFixed(4),
      totalNet: doc.totalNet.toFixed(4),
      vatAmount: doc.vatAmount.toFixed(4),
      issuerName: doc.issuerOrganization.name,
      eqaimeCompare,
    };
  }

  async listOutbox(issuerOrgId: string) {
    const items = await this.prisma.networkDocument.findMany({
      where: { issuerOrganizationId: issuerOrgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        recipientOrganization: { select: { name: true } },
      },
    });
    return {
      items: items.map((d) => ({
        id: d.id,
        correlationId: d.correlationId,
        status: d.status,
        recipientOrganizationId: d.recipientOrganizationId,
        recipientName: d.recipientOrganization.name,
        issuerInvoiceNumber: d.issuerInvoiceNumber,
        totalGross: d.totalGross.toFixed(4),
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }
}
