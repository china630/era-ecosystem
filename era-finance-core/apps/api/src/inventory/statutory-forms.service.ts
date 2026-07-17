import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryAdjustmentDocType,
  StockMovementReason,
  StockMovementType,
} from "@erafinance/database";
import PDFDocument from "pdfkit";
import { PrismaService } from "../prisma/prisma.service";
import {
  PDF_FONT_UNICODE,
  PDF_FONT_UNICODE_BOLD,
  registerUnicodeFonts,
} from "../reporting/pdf-font.util";

function pdfBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerUnicodeFonts(doc);
    build(doc);
    doc.end();
  });
}

@Injectable()
export class StatutoryFormsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Forma-5 (release requisition) from warehouse shipment stock movements.
   * `:id` is the sales invoice id that the shipment settled.
   */
  async buildForma5Pdf(
    organizationId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: {
        id: true,
        number: true,
        dueDate: true,
        createdAt: true,
        counterparty: { select: { nameCipher: true } },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        invoiceId,
        type: StockMovementType.OUT,
        reason: StockMovementReason.SHIPMENT,
      },
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: [{ documentDate: "asc" }, { createdAt: "asc" }],
    });
    if (!movements.length) {
      throw new NotFoundException("No warehouse shipment found for this invoice");
    }

    const warehouseName = movements[0]?.warehouse?.name ?? "—";
    const docDate = movements[0]?.documentDate ?? invoice.createdAt;
    const buffer = await pdfBuffer((doc) => {
      doc.font(PDF_FONT_UNICODE_BOLD).fontSize(14).text("Forma-5 — Tələbnamə / Məxaric", {
        align: "center",
      });
      doc.moveDown(0.5);
      doc.font(PDF_FONT_UNICODE).fontSize(10);
      doc.text(`Invoice: ${invoice.number}`);
      doc.text(`Date: ${docDate.toISOString().slice(0, 10)}`);
      doc.text(`Warehouse: ${warehouseName}`);
      doc.text(`Counterparty: ${invoice.counterparty?.nameCipher?.trim() || "—"}`);
      doc.moveDown();
      doc.font(PDF_FONT_UNICODE_BOLD).text("Lines");
      doc.font(PDF_FONT_UNICODE);
      let i = 1;
      for (const m of movements) {
        doc.text(
          `${i}. ${m.product.sku} — ${m.product.name}: ${m.quantity.toString()} @ ${m.price.toString()}`,
        );
        i += 1;
      }
      doc.moveDown(2);
      doc.text("Issued by: ____________________    Received by: ____________________");
    });

    return {
      buffer,
      filename: `forma-5-${invoice.number.replace(/[^\w.-]+/g, "_")}.pdf`,
    };
  }

  /**
   * Forma-2 (write-off / surplus act) from posted InventoryAdjustment.
   */
  async buildForma2Pdf(
    organizationId: string,
    adjustmentId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const adj = await this.prisma.inventoryAdjustment.findFirst({
      where: { id: adjustmentId, organizationId },
      include: {
        warehouse: { select: { name: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
    });
    if (!adj) throw new NotFoundException("Inventory adjustment not found");

    const title =
      adj.docType === InventoryAdjustmentDocType.WRITE_OFF
        ? "Forma-2 — Silinmə aktı"
        : adj.docType === InventoryAdjustmentDocType.SURPLUS
          ? "Forma-2 — Artıqlıq aktı"
          : "Forma-2 — İnventarizasiya aktı";

    const buffer = await pdfBuffer((doc) => {
      doc.font(PDF_FONT_UNICODE_BOLD).fontSize(14).text(title, { align: "center" });
      doc.moveDown(0.5);
      doc.font(PDF_FONT_UNICODE).fontSize(10);
      doc.text(`Document id: ${adj.id}`);
      doc.text(`Date: ${adj.date.toISOString().slice(0, 10)}`);
      doc.text(`Warehouse: ${adj.warehouse?.name ?? "—"}`);
      doc.text(`Status: ${adj.status}`);
      doc.text(`Reason: ${adj.reason || "—"}`);
      doc.moveDown();
      doc.font(PDF_FONT_UNICODE_BOLD).text("Lines");
      doc.font(PDF_FONT_UNICODE);
      let i = 1;
      for (const line of adj.lines) {
        doc.text(
          `${i}. ${line.product.sku} — ${line.product.name}: expected ${line.expectedQuantity.toString()}, actual ${line.actualQuantity.toString()}, delta ${line.deltaQuantity.toString()} @ ${line.unitCost.toString()}`,
        );
        i += 1;
      }
      doc.moveDown(2);
      doc.text("Commission: ____________________    Accountant: ____________________");
    });

    return {
      buffer,
      filename: `forma-2-${adj.docType.toLowerCase()}-${adj.id.slice(0, 8)}.pdf`,
    };
  }
}
