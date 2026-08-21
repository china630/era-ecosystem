import PDFDocument from "pdfkit";
import {
  PDF_FONT_UNICODE,
  PDF_FONT_UNICODE_BOLD,
  registerUnicodeFonts,
} from "../reporting/pdf-font.util";

export type ManualAdjustmentVoucherPdfLine = {
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
};

export type ManualAdjustmentVoucherPdfModel = {
  organizationName: string;
  organizationTaxId: string;
  date: string;
  reference: string;
  reason: string;
  basisLabel: string | null;
  counterpartyName: string | null;
  lines: ManualAdjustmentVoucherPdfLine[];
  disclaimerAz: string;
  disclaimerRu: string;
};

export async function renderManualAdjustmentVoucherPdf(
  data: ManualAdjustmentVoucherPdfModel,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      info: { Title: "Accounting certificate" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    registerUnicodeFonts(doc);

    let y = 40;
    doc.font(PDF_FONT_UNICODE_BOLD).fontSize(14).text("Mühasibat arayışı / Бухгалтерская справка", 40, y);
    y += 28;
    doc.font(PDF_FONT_UNICODE).fontSize(10);
    doc.text(`${data.organizationName} · VÖEN ${data.organizationTaxId}`, 40, y);
    y += 16;
    doc.text(`Tarix / Дата: ${data.date}`, 40, y);
    y += 14;
    doc.text(`Nömrə / Номер: ${data.reference}`, 40, y);
    y += 14;
    if (data.basisLabel) {
      doc.text(`Əsas / Основание: ${data.basisLabel}`, 40, y);
      y += 14;
    }
    if (data.counterpartyName) {
      doc.text(`Kontragent / Контрагент: ${data.counterpartyName}`, 40, y);
      y += 14;
    }
    doc.text(`Səbəb / Основание (что и почему): ${data.reason}`, 40, y, { width: 515 });
    y += doc.heightOfString(data.reason, { width: 515 }) + 12;

    const colX = [40, 120, 320, 420];
    doc.font(PDF_FONT_UNICODE_BOLD).fontSize(9);
    doc.text("Hesab", colX[0], y);
    doc.text("Ad", colX[1], y);
    doc.text("Debet", colX[2], y, { width: 90, align: "right" });
    doc.text("Kredit", colX[3], y, { width: 90, align: "right" });
    y += 14;
    doc.moveTo(40, y).lineTo(555, y).stroke();
    y += 6;

    doc.font(PDF_FONT_UNICODE).fontSize(9);
    for (const row of data.lines) {
      doc.text(row.accountCode, colX[0], y);
      doc.text(row.accountName.slice(0, 40), colX[1], y, { width: 190 });
      doc.text(row.debit, colX[2], y, { width: 90, align: "right" });
      doc.text(row.credit, colX[3], y, { width: 90, align: "right" });
      y += 14;
    }

    y += 10;
    doc.fontSize(8).fillColor("#555555");
    doc.text(data.disclaimerAz, 40, y, { width: 515 });
    y += doc.heightOfString(data.disclaimerAz, { width: 515 }) + 4;
    doc.text(data.disclaimerRu, 40, y, { width: 515 });

    doc.end();
  });
}
