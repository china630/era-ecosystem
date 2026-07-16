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

export type EqaimeCompareInput = {
  eQaimeRef: string | null;
  totalGross: Prisma.Decimal;
  issuerTaxIdBlindIndex?: string | null;
  /** Decrypted issuer VÖEN when available (for voen compare). */
  issuerTaxId?: string | null;
  /** Snapshot from DVX ingest / RPA (optional). */
  eqaimePayload?: unknown;
};

export type EqaimeCompareResult = {
  status: "MATCH" | "MISMATCH" | "MISSING";
  ref?: string | null;
  details?: {
    amountMatch?: boolean;
    voenMatch?: boolean | null;
    expectedGross?: string;
    eqaimeGross?: string | null;
    expectedVoen?: string | null;
    eqaimeVoen?: string | null;
  };
};

function extractEqaimeGross(payload: unknown): Prisma.Decimal | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const totals = p.totals;
  if (totals && typeof totals === "object") {
    const g = (totals as Record<string, unknown>).grossAzn ?? (totals as Record<string, unknown>).totalGross;
    if (g != null && g !== "") {
      try {
        return new Decimal(String(g));
      } catch {
        return null;
      }
    }
  }
  for (const key of ["totalGross", "grossAzn", "totalGrossAzn", "amount"]) {
    if (p[key] != null && p[key] !== "") {
      try {
        return new Decimal(String(p[key]));
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

function extractEqaimeVoen(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const issuer = p.issuer;
  if (issuer && typeof issuer === "object") {
    const taxId = (issuer as Record<string, unknown>).taxId ?? (issuer as Record<string, unknown>).voen;
    if (typeof taxId === "string" && taxId.trim()) {
      return normalizeVoen(taxId);
    }
  }
  for (const key of ["issuerTaxId", "sellerVoen", "voen", "taxId"]) {
    if (typeof p[key] === "string" && (p[key] as string).trim()) {
      return normalizeVoen(p[key] as string);
    }
  }
  return null;
}

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

  /**
   * Compare network document totals / issuer VÖEN against ingested e-qaimə payload when present.
   * MISSING — no ref; MATCH — ref present and amounts/voen agree (or no comparable data);
   * MISMATCH — comparable field present and differs.
   */
  compareWithEQaime(doc: EqaimeCompareInput): EqaimeCompareResult {
    if (!doc.eQaimeRef?.trim()) {
      return { status: "MISSING" };
    }

    const ref = doc.eQaimeRef.trim();
    const payload = doc.eqaimePayload;
    const eqaimeGross = extractEqaimeGross(payload);
    const eqaimeVoen = extractEqaimeVoen(payload);

    const details: EqaimeCompareResult["details"] = {
      expectedGross: doc.totalGross.toFixed(4),
      eqaimeGross: eqaimeGross?.toFixed(4) ?? null,
      eqaimeVoen,
    };

    let amountMatch: boolean | undefined;
    if (eqaimeGross != null) {
      amountMatch = doc.totalGross.sub(eqaimeGross).abs().lte(new Decimal("0.01"));
      details.amountMatch = amountMatch;
    }

    let voenMatch: boolean | undefined;
    const expectedVoen = doc.issuerTaxId
      ? normalizeVoen(doc.issuerTaxId)
      : null;
    details.expectedVoen = expectedVoen;
    if (eqaimeVoen && expectedVoen) {
      voenMatch = eqaimeVoen === expectedVoen;
      details.voenMatch = voenMatch;
    } else if (eqaimeVoen) {
      details.voenMatch = null;
    }

    if (amountMatch === false || voenMatch === false) {
      return { status: "MISMATCH", ref, details };
    }
    return { status: "MATCH", ref, details };
  }

  /**
   * Attach a manual / RPA DVX e-qaimə payload for reconciliation.
   */
  async ingestEqaimePayload(
    recipientOrgId: string,
    networkDocId: string,
    body: {
      externalId?: string;
      payload?: Record<string, unknown>;
      totalGross?: number | string;
      issuerTaxId?: string;
    },
  ) {
    const doc = await this.prisma.networkDocument.findFirst({
      where: { id: networkDocId, recipientOrganizationId: recipientOrgId },
    });
    if (!doc) throw new NotFoundException("Network document not found");

    const payload: Record<string, unknown> = {
      ...(body.payload ?? {}),
    };
    if (body.totalGross != null && payload.totalGross == null && payload.totals == null) {
      payload.totals = { grossAzn: Number(body.totalGross) };
    }
    if (body.issuerTaxId?.trim() && payload.issuerTaxId == null) {
      payload.issuerTaxId = normalizeVoen(body.issuerTaxId);
    }

    const externalId =
      (typeof body.externalId === "string" && body.externalId.trim()) ||
      (typeof payload.eqaimeNumber === "string" && payload.eqaimeNumber.trim()) ||
      (typeof payload.id === "string" && payload.id.trim()) ||
      doc.eQaimeRef ||
      null;

    if (!externalId) {
      throw new BadRequestException("externalId (or payload.eqaimeNumber) is required");
    }

    const updated = await this.prisma.networkDocument.update({
      where: { id: doc.id },
      data: {
        eQaimeRef: externalId,
        eqaimePayload: payload as Prisma.InputJsonValue,
      },
    });

    const compare = this.compareWithEQaime({
      eQaimeRef: updated.eQaimeRef,
      totalGross: updated.totalGross,
      issuerTaxIdBlindIndex: updated.issuerTaxIdBlindIndex,
      issuerTaxId:
        typeof payload.issuerTaxId === "string"
          ? (payload.issuerTaxId as string)
          : body.issuerTaxId ?? null,
      eqaimePayload: updated.eqaimePayload,
    });

    return {
      id: updated.id,
      eQaimeRef: updated.eQaimeRef,
      eqaimeCompare: compare,
    };
  }
}
