import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EqaimeStatus } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { InvoicesService } from "./invoices.service";
import { EtaxesSubmissionAdapterFactory } from "../reporting/etaxes-submission.adapters";
import { SignatureService } from "../signature/signature.service";
import { decodeOrganizationTaxId } from "../security/pii-crypto.util";

@Injectable()
export class EqaimeSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly submissionFactory: EtaxesSubmissionAdapterFactory,
    private readonly signatures: SignatureService,
    private readonly config: ConfigService,
  ) {}

  isS2sEnabled(): boolean {
    const raw = this.config.get<string>("ERA_EQAIME_S2S_ENABLED", "0");
    return raw === "1" || raw?.toLowerCase() === "true";
  }

  private assertS2sAvailable(): void {
    if (!this.isS2sEnabled()) {
      throw new HttpException(
        {
          code: "EQAIME_S2S_DISABLED",
          message:
            "e-Qaim╔Щ S2S is disabled. Set ERA_EQAIME_S2S_ENABLED=1 or use ERA Finance Assistant RPA.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private resolveAsanUserId(settingsJson: unknown): string | null {
    if (!settingsJson || typeof settingsJson !== "object") return null;
    const tax = (settingsJson as Record<string, unknown>).tax;
    if (!tax || typeof tax !== "object") return null;
    const id = (tax as Record<string, unknown>).asanUserId;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }

  async buildPackage(invoiceId: string, organizationId: string) {
    const prefill = await this.invoices.getExtensionPrefill(organizationId, invoiceId);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, taxIdCipher: true, settings: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const issuerTaxId = decodeOrganizationTaxId(org);
    return {
      version: 1,
      channel: "EQAIME_S2S",
      invoiceId,
      issuer: {
        name: org.name,
        taxId: issuerTaxId,
        asanUserId: this.resolveAsanUserId(org.settings),
      },
      document: prefill,
    };
  }

  async getStatus(organizationId: string, invoiceId: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: {
        id: true,
        number: true,
        eqaimeNumber: true,
        eqaimeStatus: true,
        eqaimeSubmittedAt: true,
        dvxExternalId: true,
        dvxSyncStatus: true,
      },
    });
    if (!inv) throw new NotFoundException("Invoice not found");
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      eqaimeNumber: inv.eqaimeNumber,
      eqaimeStatus: inv.eqaimeStatus,
      eqaimeSubmittedAt: inv.eqaimeSubmittedAt?.toISOString() ?? null,
      dvxExternalId: inv.dvxExternalId,
      dvxSyncStatus: inv.dvxSyncStatus,
      s2sEnabled: this.isS2sEnabled(),
    };
  }

  async submit(organizationId: string, invoiceId: string) {
    this.assertS2sAvailable();

    const inv = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: {
        id: true,
        status: true,
        eqaimeStatus: true,
        isInternational: true,
        currency: true,
      },
    });
    if (!inv) throw new NotFoundException("Invoice not found");
    if (inv.isInternational) {
      throw new BadRequestException("International invoices cannot be submitted as e-Qaim╔Щ");
    }
    if (inv.currency !== "AZN") {
      throw new BadRequestException("Only AZN invoices support e-Qaim╔Щ S2S");
    }
    if (
      inv.eqaimeStatus === EqaimeStatus.SUBMITTED ||
      inv.eqaimeStatus === EqaimeStatus.ACCEPTED
    ) {
      throw new BadRequestException("e-Qaim╔Щ already submitted for this invoice");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const asanUserId = this.resolveAsanUserId(org?.settings);
    if (!asanUserId) {
      throw new HttpException(
        {
          code: "ASAN_USER_ID_REQUIRED",
          message:
            "Organization.settings.tax.asanUserId is required for e-Qaim╔Щ S2S. Configure in organization settings.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const pkg = await this.buildPackage(invoiceId, organizationId);
    const signed = await this.signatures.signGovPayload(JSON.stringify(pkg), {
      organizationId,
      asanUserId,
      purpose: "EQAIME",
    });
    const signedPayload = {
      ...pkg,
      govSignature: {
        signatureId: signed.signatureId,
        signedAt: signed.signedAt.toISOString(),
        provider: signed.provider,
      },
    };

    const adapter = this.submissionFactory.get();
    const result = await adapter.submit(signedPayload, {
      organizationId,
      asanUserId,
      destination: "EQAIME",
    });

    const eqaimeNumber =
      typeof (result as Record<string, unknown>).eqaimeNumber === "string"
        ? ((result as Record<string, unknown>).eqaimeNumber as string)
        : signed.signatureId;

    const submittedAt = new Date();
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eqaimeNumber,
        eqaimeStatus: EqaimeStatus.SUBMITTED,
        eqaimeSubmittedAt: submittedAt,
        dvxExternalId: eqaimeNumber,
      },
    });

    return {
      submitted: result.submitted,
      eqaimeNumber,
      eqaimeStatus: EqaimeStatus.SUBMITTED,
      eqaimeSubmittedAt: submittedAt.toISOString(),
      gatewayStatus: result.gatewayStatus,
    };
  }

  /**
   * Minimal incoming pull stub: maps a network document into a purchase draft descriptor.
   */
  async buildPurchaseDraftFromNetworkDocument(
    recipientOrgId: string,
    networkDocId: string,
  ): Promise<{
    draftKind: "PURCHASE_INVOICE";
    networkDocumentId: string;
    counterpartyTaxId: string | null;
    currency: string;
    totalGross: string;
    lines: Array<{
      description: string | null;
      quantity: string;
      unitPrice: string;
      vatRate: string;
      lineTotal: string;
    }>;
  }> {
    const doc = await this.prisma.networkDocument.findFirst({
      where: { id: networkDocId, recipientOrganizationId: recipientOrgId },
    });
    if (!doc) throw new NotFoundException("Network document not found");

    const issuer = await this.prisma.organization.findFirst({
      where: { id: doc.issuerOrganizationId },
      select: { taxIdCipher: true },
    });
    const issuerTaxId = issuer?.taxIdCipher
      ? decodeOrganizationTaxId(issuer)
      : null;

    const linesRaw = Array.isArray(doc.lines)
      ? (doc.lines as Array<Record<string, unknown>>)
      : [];

    return {
      draftKind: "PURCHASE_INVOICE",
      networkDocumentId: doc.id,
      counterpartyTaxId: issuerTaxId,
      currency: doc.currency,
      totalGross: doc.totalGross.toString(),
      lines: linesRaw.map((line) => ({
        description:
          typeof line.description === "string" ? line.description : null,
        quantity: String(line.quantity ?? "0"),
        unitPrice: String(line.unitPrice ?? "0"),
        vatRate: String(line.vatRate ?? "0"),
        lineTotal: String(line.lineTotal ?? "0"),
      })),
    };
  }

  /**
   * Incoming pull stub from a submitted e-qaim╔Щ payload (no network doc).
   */
  buildPurchaseDraftFromEqaimePayload(payload: {
    issuerTaxId?: string | null;
    currency?: string;
    lines?: Array<{
      name?: string;
      quantity?: number;
      unitPriceAzn?: number;
      vatRatePct?: number;
      totalGrossAzn?: number;
    }>;
    totals?: { grossAzn?: number };
  }) {
    const lines = (payload.lines ?? []).map((line) => ({
      description: line.name ?? null,
      quantity: String(line.quantity ?? 0),
      unitPrice: String(line.unitPriceAzn ?? 0),
      vatRate: String(line.vatRatePct ?? 0),
      lineTotal: String(line.totalGrossAzn ?? 0),
    }));
    return {
      draftKind: "PURCHASE_INVOICE" as const,
      counterpartyTaxId: payload.issuerTaxId ?? null,
      currency: payload.currency ?? "AZN",
      totalGross: String(payload.totals?.grossAzn ?? 0),
      lines,
    };
  }
}
