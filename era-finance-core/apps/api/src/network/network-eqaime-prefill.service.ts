import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoicePrefillSchema, type InvoicePrefill } from "@erafinance/api-contracts";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { decryptText, normalizeVoen } from "../security/pii-crypto.util";

const Decimal = Prisma.Decimal;

type StoredLine = {
  description?: string | null;
  quantity?: string;
  unitPrice?: string;
  vatRate?: string;
  lineTotal?: string;
  productId?: string | null;
};

@Injectable()
export class NetworkEqaimePrefillService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPrefillFromNetworkDocument(
    recipientOrgId: string,
    networkDocId: string,
  ): Promise<InvoicePrefill> {
    const doc = await this.prisma.networkDocument.findFirst({
      where: { id: networkDocId, recipientOrganizationId: recipientOrgId },
    });
    if (!doc) throw new NotFoundException("Network document not found");
    if (doc.currency !== "AZN") {
      throw new BadRequestException("Only AZN network documents support e-Qaimə prefill");
    }

    const issuer = await this.prisma.organization.findFirst({
      where: { id: doc.issuerOrganizationId },
      select: { name: true, taxIdCipher: true, taxIdBlindIndex: true },
    });
    if (!issuer) throw new NotFoundException("Issuer organization not found");

    const issuerTaxId = issuer.taxIdCipher
      ? decryptText(issuer.taxIdCipher)
      : null;
    const linesRaw = Array.isArray(doc.lines) ? (doc.lines as StoredLine[]) : [];

    const items = linesRaw.map((line) => {
      const gross = Number(line.lineTotal ?? "0");
      const vatRate = Number(line.vatRate ?? "0");
      const vatExempt = vatRate < 0;
      const vatBasePct = vatExempt ? 0 : vatRate;
      const net = vatBasePct > 0 ? gross / (1 + vatBasePct / 100) : gross;
      const vat = gross - net;
      const qty = Number(line.quantity ?? "1");
      const unitNet = qty > 0 ? net / qty : net;
      return {
        name: line.description?.trim() || "Item",
        sku: null,
        quantity: qty,
        unit: null,
        unitPriceAzn: Number(unitNet.toFixed(4)),
        vatRatePct: vatBasePct,
        vatExempt,
        totalNetAzn: Number(net.toFixed(4)),
        totalVatAzn: Number(vat.toFixed(4)),
        totalGrossAzn: gross,
      };
    });

    const totals = items.reduce(
      (acc, line) => {
        acc.netAzn += line.totalNetAzn;
        acc.vatAzn += line.totalVatAzn;
        acc.grossAzn += line.totalGrossAzn;
        return acc;
      },
      { netAzn: 0, vatAzn: 0, grossAzn: 0 },
    );

    let counterpartyId: string | null = null;
    if (issuer.taxIdBlindIndex) {
      const cp = await this.prisma.counterparty.findFirst({
        where: {
          organizationId: recipientOrgId,
          taxIdBlindIndex: issuer.taxIdBlindIndex,
          deletedAt: null,
        },
        select: { id: true },
      });
      counterpartyId = cp?.id ?? null;
    }

    return InvoicePrefillSchema.parse({
      id: doc.id,
      number: doc.issuerInvoiceNumber ?? doc.correlationId,
      issueDate: doc.createdAt.toISOString(),
      currency: "AZN",
      counterparty: {
        id: counterpartyId ?? doc.issuerOrganizationId,
        name: issuer.name,
        taxId:
          issuerTaxId && /^\d{10}$/.test(issuerTaxId.replace(/\D/g, ""))
            ? normalizeVoen(issuerTaxId)
            : null,
        legalForm: "LLC",
        address: null,
        isVatPayer: doc.vatAmount.gt(0),
      },
      items,
      totals: {
        netAzn: Number(totals.netAzn.toFixed(4)),
        vatAzn: Number(totals.vatAzn.toFixed(4)),
        grossAzn: Number(totals.grossAzn.toFixed(4)),
      },
      notes: `ERA network document ${doc.id}`,
      isInternational: false,
    });
  }

  compareWithEQaime(
    doc: { eQaimeRef: string | null; totalGross: Prisma.Decimal },
  ): { status: "MATCH" | "MISMATCH" | "MISSING"; ref?: string | null } {
    if (!doc.eQaimeRef?.trim()) {
      return { status: "MISSING" };
    }
    return { status: "MATCH", ref: doc.eQaimeRef.trim() };
  }
}
