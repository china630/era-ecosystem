import { Injectable } from "@nestjs/common";
import {
  Decimal,
  InvoiceStatus,
  Prisma,
  StockMovementReason,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { decryptText } from "../security/pii-crypto.util";

export function quarterUtcRange(
  year: number,
  quarter: number,
): { from: Date; to: Date; fromStr: string; toStr: string } {
  const q = Math.min(4, Math.max(1, quarter));
  const m0 = (q - 1) * 3;
  const from = new Date(Date.UTC(year, m0, 1, 12, 0, 0, 0));
  const to = new Date(Date.UTC(year, m0 + 3, 0, 12, 0, 0, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from, to, fromStr: iso(from), toStr: iso(to) };
}

export function dateInRangeInclusive(
  isoDate: string,
  fromStr: string,
  toStr: string,
): boolean {
  return isoDate >= fromStr && isoDate <= toStr;
}

export function invoiceEffectiveDateIso(inv: {
  recognizedAt: Date | null;
  createdAt: Date;
}): string {
  const d = inv.recognizedAt ?? inv.createdAt;
  return d.toISOString().slice(0, 10);
}

function parseBasisTransactionId(note: string | null | undefined): string | null {
  if (!note) return null;
  const m = /BASIS_TX:([0-9a-f-]{36})/i.exec(note);
  return m?.[1] ?? null;
}

export type VatQuarterSalesRow = {
  date: string;
  documentNumber: string;
  counterpartyName: string;
  counterpartyVoen: string;
  description: string;
  quantity: number;
  amountWithoutVat: string;
  vatAmount: string;
  amountWithVat: string;
  vatRatePercent: string;
  invoiceId: string;
  invoiceLineId: string;
  productId: string | null;
  productSku: string | null;
};

export type VatQuarterPurchaseRow = {
  date: string;
  documentNumber: string;
  supplierName: string;
  supplierVoen: string;
  description: string;
  quantity: number;
  amountWithoutVat: string;
  vatAmount: string;
  amountWithVat: string;
  vatRatePercent: string;
  stockMovementId: string;
  productId: string;
  productSku: string;
  /** goods | services */
  kind: "goods" | "services";
  transactionId: string | null;
};

export type VatQuarterTotals = {
  salesNet: string;
  salesVat: string;
  salesGross: string;
  purchasesNet: string;
  purchasesVat: string;
  purchasesGross: string;
  /** Output VAT (начисленный) */
  outputVat: string;
  /** Input VAT (входящий) */
  inputVat: string;
  /** К уплате = output − input (может быть отрицательным → к возмещению) */
  vatPayable: string;
};

@Injectable()
export class VatQuarterDataService {
  constructor(private readonly prisma: PrismaService) {}

  computeTotals(
    sales: VatQuarterSalesRow[],
    purchases: VatQuarterPurchaseRow[],
  ): VatQuarterTotals {
    const sum = (rows: Array<{ amountWithoutVat: string; vatAmount: string; amountWithVat: string }>) => {
      let net = new Decimal(0);
      let vat = new Decimal(0);
      let gross = new Decimal(0);
      for (const r of rows) {
        net = net.add(new Decimal(r.amountWithoutVat));
        vat = vat.add(new Decimal(r.vatAmount));
        gross = gross.add(new Decimal(r.amountWithVat));
      }
      return { net, vat, gross };
    };
    const s = sum(sales);
    const p = sum(purchases);
    const payable = s.vat.sub(p.vat);
    return {
      salesNet: s.net.toFixed(4),
      salesVat: s.vat.toFixed(4),
      salesGross: s.gross.toFixed(4),
      purchasesNet: p.net.toFixed(4),
      purchasesVat: p.vat.toFixed(4),
      purchasesGross: p.gross.toFixed(4),
      outputVat: s.vat.toFixed(4),
      inputVat: p.vat.toFixed(4),
      vatPayable: payable.toFixed(4),
    };
  }

  async loadQuarterVatRows(
    organizationId: string,
    year: number,
    quarter: number,
  ): Promise<{
    fromStr: string;
    toStr: string;
    sales: VatQuarterSalesRow[];
    purchases: VatQuarterPurchaseRow[];
    totals: VatQuarterTotals;
  }> {
    const { from, to, fromStr, toStr } = quarterUtcRange(year, quarter);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { not: InvoiceStatus.CANCELLED },
      },
      include: {
        counterparty: true,
        items: { include: { product: true } },
      },
    });

    const sales: VatQuarterSalesRow[] = [];

    for (const inv of invoices) {
      const eff = invoiceEffectiveDateIso(inv);
      if (!dateInRangeInclusive(eff, fromStr, toStr)) continue;
      for (const line of inv.items) {
        const rateRaw = new Decimal(line.vatRate);
        const rate = rateRaw.lt(0) ? new Decimal(0) : rateRaw;
        const lineTotal = new Decimal(line.lineTotal);
        const div = new Decimal(1).add(rate.div(100));
        const exVat = lineTotal.div(div);
        const vat = lineTotal.sub(exVat);
        const desc =
          line.description?.trim() || line.product?.name || "—";
        sales.push({
          date: eff,
          documentNumber: inv.number,
          counterpartyName: inv.counterparty.nameCipher
            ? decryptText(inv.counterparty.nameCipher) ?? ""
            : "",
          counterpartyVoen: inv.counterparty.taxIdCipher
            ? decryptText(inv.counterparty.taxIdCipher) ?? ""
            : "",
          description: desc,
          quantity: Number(line.quantity),
          amountWithoutVat: exVat.toFixed(4),
          vatAmount: vat.toFixed(4),
          amountWithVat: lineTotal.toFixed(4),
          vatRatePercent: rateRaw.toFixed(2),
          invoiceId: inv.id,
          invoiceLineId: line.id,
          productId: line.productId,
          productSku: line.product?.sku ?? null,
        });
      }
    }

    // Goods: warehouse IN with PURCHASE (legacy) or RECEIPT (current). Include services? No — stock only goods.
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        type: "IN",
        reason: { in: [StockMovementReason.PURCHASE, StockMovementReason.RECEIPT] },
        documentDate: { gte: from, lte: to },
      },
      include: { product: true },
    });

    const basisTxIds = [
      ...new Set(
        movements
          .map((m) => parseBasisTransactionId(m.note))
          .filter((id): id is string => !!id),
      ),
    ];
    const basisTxs =
      basisTxIds.length > 0
        ? await this.prisma.transaction.findMany({
            where: { organizationId, id: { in: basisTxIds } },
            select: {
              id: true,
              reference: true,
              date: true,
              counterpartyId: true,
              counterparty: {
                select: { nameCipher: true, taxIdCipher: true },
              },
            },
          })
        : [];
    const basisMap = new Map(basisTxs.map((t) => [t.id, t]));

    const purchases: VatQuarterPurchaseRow[] = [];

    for (const m of movements) {
      // Skip services if somehow posted to stock
      if (m.product.isService) continue;
      const eff = m.documentDate.toISOString().slice(0, 10);
      if (!dateInRangeInclusive(eff, fromStr, toStr)) continue;
      const qty = new Decimal(m.quantity);
      const price = new Decimal(m.price);
      const lineTotal = qty.mul(price);
      const rateRaw = new Decimal(m.product.vatRate);
      const rate = rateRaw.lt(0) ? new Decimal(0) : rateRaw;
      const div = new Decimal(1).add(rate.div(100));
      const exVat = lineTotal.div(div);
      const vat = lineTotal.sub(exVat);
      const basisId = parseBasisTransactionId(m.note);
      const basis = basisId ? basisMap.get(basisId) : undefined;
      const supplierName = basis?.counterparty?.nameCipher
        ? decryptText(basis.counterparty.nameCipher) ?? ""
        : "";
      const supplierVoen = basis?.counterparty?.taxIdCipher
        ? decryptText(basis.counterparty.taxIdCipher) ?? ""
        : "";
      purchases.push({
        date: eff,
        documentNumber:
          basis?.reference?.trim() || `WH-${m.id.slice(0, 8)}`,
        supplierName,
        supplierVoen,
        description: m.product.name,
        quantity: Number(qty),
        amountWithoutVat: exVat.toFixed(4),
        vatAmount: vat.toFixed(4),
        amountWithVat: lineTotal.toFixed(4),
        vatRatePercent: rateRaw.toFixed(2),
        stockMovementId: m.id,
        productId: m.productId,
        productSku: m.product.sku,
        kind: "goods",
        transactionId: basisId,
      });
    }

    // Services: from purchase transactions with purchaseSnapshot (kind: services)
    const purchaseTxs = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        isFinal: true,
        date: { gte: from, lte: to },
        purchaseSnapshot: { not: Prisma.DbNull },
        counterpartyId: { not: null },
      },
      select: {
        id: true,
        date: true,
        reference: true,
        purchaseSnapshot: true,
        counterparty: {
          select: { nameCipher: true, taxIdCipher: true },
        },
      },
    });

    type SnapshotLine = {
      kind?: string;
      productId?: string;
      quantity?: number;
      productName?: string;
      sku?: string;
      unitPrice?: number | string;
      vatRate?: number | string;
      lineTotal?: number | string;
      netAmount?: number | string;
      vatAmount?: number | string;
    };

    for (const tx of purchaseTxs) {
      const snap = tx.purchaseSnapshot as
        | { version?: number; lines?: SnapshotLine[] }
        | null;
      const lines = Array.isArray(snap?.lines) ? snap!.lines! : [];
      const serviceLines = lines.filter(
        (l) => (l.kind ?? "").toLowerCase() === "services" && l.productId,
      );
      if (serviceLines.length === 0) continue;

      const supplierName = tx.counterparty?.nameCipher
        ? decryptText(tx.counterparty.nameCipher) ?? ""
        : "";
      const supplierVoen = tx.counterparty?.taxIdCipher
        ? decryptText(tx.counterparty.taxIdCipher) ?? ""
        : "";
      const eff = tx.date.toISOString().slice(0, 10);

      for (const line of serviceLines) {
        const product = await this.prisma.product.findFirst({
          where: { id: line.productId!, organizationId },
          select: { id: true, sku: true, name: true, vatRate: true },
        });
        if (!product) continue;

        const qty = new Decimal(line.quantity ?? 1);
        const rateRaw = new Decimal(
          line.vatRate != null ? line.vatRate : product.vatRate,
        );
        const rate = rateRaw.lt(0) ? new Decimal(0) : rateRaw;
        let exVat: Decimal;
        let vat: Decimal;
        let gross: Decimal;
        if (line.vatAmount != null && line.netAmount != null) {
          exVat = new Decimal(line.netAmount);
          vat = new Decimal(line.vatAmount);
          gross = exVat.add(vat);
        } else if (line.lineTotal != null) {
          gross = new Decimal(line.lineTotal);
          const div = new Decimal(1).add(rate.div(100));
          exVat = gross.div(div);
          vat = gross.sub(exVat);
        } else if (line.unitPrice != null) {
          const unit = new Decimal(line.unitPrice);
          exVat = qty.mul(unit);
          vat = exVat.mul(rate.div(100));
          gross = exVat.add(vat);
        } else {
          continue;
        }

        purchases.push({
          date: eff,
          documentNumber: tx.reference?.trim() || `SVC-${tx.id.slice(0, 8)}`,
          supplierName,
          supplierVoen,
          description: line.productName || product.name,
          quantity: Number(qty),
          amountWithoutVat: exVat.toFixed(4),
          vatAmount: vat.toFixed(4),
          amountWithVat: gross.toFixed(4),
          vatRatePercent: rateRaw.toFixed(2),
          stockMovementId: `svc:${tx.id}:${product.id}`,
          productId: product.id,
          productSku: line.sku || product.sku,
          kind: "services",
          transactionId: tx.id,
        });
      }
    }

    const totals = this.computeTotals(sales, purchases);
    return { fromStr, toStr, sales, purchases, totals };
  }
}
