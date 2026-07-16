import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import {
  PDF_FONT_UNICODE,
  PDF_FONT_UNICODE_BOLD,
  registerUnicodeFonts,
} from "../reporting/pdf-font.util";

export type InvoicePdfModel = {
  number: string;
  status: string;
  dueDate: Date;
  totalAmount: { toString(): string };
  currency: string;
  isInternational?: boolean;
  tradeContext?: "DOMESTIC" | "EXPORT" | "IMPORT";
  incoterms?: string | null;
  exportDeclarationRef?: string | null;
  countryOfDestination?: string | null;
  counterparty: { name: string; taxId: string; country?: string | null };
  items: Array<{
    description: string | null;
    quantity: { toString(): string };
    unitPrice: { toString(): string };
    vatRate: { toString(): string };
    lineTotal: { toString(): string };
    product: { name: string; isService?: boolean } | null;
  }>;
  /** Печать + QR на публичную верификацию */
  signature?: {
    verifyUrl: string;
    signedAt: Date;
    providerLabel: string;
    certificateSubject: string | null;
  };
};

function tradeContextLabel(ctx: InvoicePdfModel["tradeContext"]): {
  en: string;
  az: string;
  ru: string;
} {
  if (ctx === "EXPORT") {
    return { en: "Export", az: "İxrac", ru: "Экспорт" };
  }
  if (ctx === "IMPORT") {
    return { en: "Import", az: "İdxal", ru: "Импорт" };
  }
  return { en: "Domestic", az: "Daxili", ru: "Внутренний" };
}

export async function renderInvoicePdf(
  invoice: InvoicePdfModel,
): Promise<Buffer> {
  const qrBuffer =
    invoice.signature != null
      ? await QRCode.toBuffer(invoice.signature.verifyUrl, {
          type: "png",
          width: 240,
          margin: 1,
        })
      : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    registerUnicodeFonts(doc);
    doc.font(PDF_FONT_UNICODE);

    const isExport =
      invoice.isInternational ||
      invoice.tradeContext === "EXPORT" ||
      invoice.tradeContext === "IMPORT";
    const title = isExport ? "Commercial Invoice" : "Invoice";
    const titleAz = isExport ? "Kommersiya hesab-fakturası" : "Hesab-faktura";
    const titleRu = isExport ? "Коммерческий инвойс" : "Счёт";

    doc.fontSize(18).font(PDF_FONT_UNICODE_BOLD).text(`${title} / ${titleAz}`, {
      underline: true,
    });
    doc.font(PDF_FONT_UNICODE).fontSize(10).text(`${titleRu} ${invoice.number}`);
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Status / Status / Статус: ${invoice.status}`);
    doc.text(
      `Due / Son ödəmə / Срок: ${invoice.dueDate.toISOString().slice(0, 10)}`,
    );

    const trade =
      invoice.tradeContext ??
      (invoice.isInternational ? "EXPORT" : "DOMESTIC");
    const tradeLabels = tradeContextLabel(trade);
    doc.text(
      `Trade / Ticarət / Контекст: ${tradeLabels.en} / ${tradeLabels.az} / ${tradeLabels.ru}`,
    );
    if (invoice.incoterms) {
      doc.text(`Incoterms: ${invoice.incoterms}`);
    }
    if (invoice.countryOfDestination) {
      doc.text(
        `Destination / Təyinat / Страна назначения: ${invoice.countryOfDestination}`,
      );
    }
    if (invoice.exportDeclarationRef) {
      doc.text(
        `Export decl. / İxrac bəy. / Эксп. декларация: ${invoice.exportDeclarationRef}`,
      );
    }

    doc.moveDown();
    doc.text(
      isExport
        ? `Buyer / Alıcı / Покупатель: ${invoice.counterparty.name}${invoice.counterparty.country ? ` (${invoice.counterparty.country})` : ""}`
        : `Customer / Müştəri / Покупатель: ${invoice.counterparty.name} (VÖEN ${invoice.counterparty.taxId})`,
    );
    doc.moveDown();
    doc.text("Lines / Sətirlər / Позиции:");
    invoice.items.forEach((line, i) => {
      const baseTitle = line.product?.name ?? line.description ?? `Line ${i + 1}`;
      const kind = line.product?.isService || line.product == null ? "Xidmət" : "Məhsul";
      const titleLine = `${kind}: ${baseTitle}`;
      doc.text(
        `${titleLine} | qty ${line.quantity.toString()} x ${line.unitPrice.toString()} | VAT ${line.vatRate.toString()}% | ${line.lineTotal.toString()} ${invoice.currency}`,
      );
    });
    doc.moveDown();
    doc
      .fontSize(12)
      .font(PDF_FONT_UNICODE_BOLD)
      .text(
        `Total / Cəmi / Итого: ${invoice.totalAmount.toString()} ${invoice.currency}`,
      );

    if (invoice.signature != null && qrBuffer) {
      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const margin = 50;
      const qrSize = 72;
      const stampW = 220;
      const xQr = pageW - margin - qrSize;
      const yQr = pageH - margin - qrSize - 8;
      const yStamp = yQr - 58;

      doc.save();
      doc.opacity(0.92);
      doc
        .roundedRect(margin, yStamp, stampW, 48, 4)
        .strokeColor("#15803d")
        .lineWidth(1.2)
        .stroke();
      doc.fillColor("#166534").fontSize(9).font(PDF_FONT_UNICODE_BOLD);
      doc.text("RƏQƏMSAL İMZA", margin + 8, yStamp + 8, { width: stampW - 16 });
      doc.font(PDF_FONT_UNICODE).fontSize(8).fillColor("#14532d");
      doc.text(
        `${invoice.signature.providerLabel} · ${invoice.signature.signedAt.toISOString().slice(0, 19).replace("T", " ")} UTC`,
        margin + 8,
        yStamp + 22,
        { width: stampW - 16 },
      );
      if (invoice.signature.certificateSubject) {
        doc.text(
          invoice.signature.certificateSubject.slice(0, 80),
          margin + 8,
          yStamp + 34,
          { width: stampW - 16 },
        );
      }
      doc.image(qrBuffer, xQr, yQr, { width: qrSize, height: qrSize });
      doc.fontSize(6).fillColor("#64748b");
      doc.text("Yoxlama / Verify", xQr, yQr + qrSize + 2, {
        width: qrSize,
        align: "center",
      });
      doc.restore();
    }

    doc.end();
  });
}
