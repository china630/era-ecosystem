import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { PDF_FONT_UNICODE, registerUnicodeFonts } from "../reporting/pdf-font.util";

function pdfBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    registerUnicodeFonts(doc);
    doc.font(PDF_FONT_UNICODE);
    build(doc);
    doc.end();
  });
}

export async function trialBalanceXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  rows: Array<{
    accountCode: string;
    accountName: string;
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Trial Balance");
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([]);
  ws.addRow([
    "Code",
    "Name",
    "Opening Dr",
    "Opening Cr",
    "Period Dr",
    "Period Cr",
    "Closing Dr",
    "Closing Cr",
  ]);
  payload.rows.forEach((r) =>
    ws.addRow([
      r.accountCode,
      r.accountName,
      Number(r.openingDebit),
      Number(r.openingCredit),
      Number(r.periodDebit),
      Number(r.periodCredit),
      Number(r.closingDebit),
      Number(r.closingCredit),
    ]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function trialBalancePdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  rows: Array<{ accountCode: string; accountName: string; periodDebit: string; periodCredit: string }>;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text("Trial Balance");
    doc.moveDown(0.5).fontSize(10).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.rows.forEach((r) => {
      doc.text(
        `${r.accountCode} | ${r.accountName} | Dr ${Number(r.periodDebit).toFixed(2)} | Cr ${Number(r.periodCredit).toFixed(2)}`,
      );
    });
  });
}

export async function plXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  lines: Array<{ label: string; amount: string }>;
  netProfit: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ProfitAndLoss");
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([]);
  ws.addRow(["Line", "Amount"]);
  payload.lines.forEach((l) => ws.addRow([l.label, Number(l.amount)]));
  ws.addRow(["Net profit", Number(payload.netProfit)]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function plPdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  lines: Array<{ label: string; amount: string }>;
  netProfit: string;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text("Profit and Loss");
    doc.moveDown(0.5).fontSize(10).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.lines.forEach((l) => {
      doc.text(`${l.label}: ${Number(l.amount).toFixed(2)}`);
    });
    doc.moveDown(0.5).fontSize(11).text(`Net profit: ${Number(payload.netProfit).toFixed(2)}`);
  });
}

export async function cashFlowXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  sections: Array<{
    section: string;
    rows: Array<{ code: string; name: string; inflow: string; outflow: string; net: string }>;
  }>;
  total: { inflow: string; outflow: string; net: string };
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("CashFlow");
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([]);
  ws.addRow(["Section", "Code", "Name", "Inflow", "Outflow", "Net"]);
  payload.sections.forEach((s) =>
    s.rows.forEach((r) =>
      ws.addRow([
        s.section,
        r.code,
        r.name,
        Number(r.inflow),
        Number(r.outflow),
        Number(r.net),
      ]),
    ),
  );
  ws.addRow(["TOTAL", "", "", Number(payload.total.inflow), Number(payload.total.outflow), Number(payload.total.net)]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function cashFlowPdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  sections: Array<{
    section: string;
    rows: Array<{ code: string; name: string; inflow: string; outflow: string; net: string }>;
  }>;
  total: { inflow: string; outflow: string; net: string };
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text("Cash Flow");
    doc.moveDown(0.5).fontSize(10).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.sections.forEach((s) => {
      doc.fontSize(10).text(s.section);
      s.rows.forEach((r) => {
        doc.fontSize(9).text(
          `${r.code} ${r.name} | In ${Number(r.inflow).toFixed(2)} | Out ${Number(r.outflow).toFixed(2)} | Net ${Number(r.net).toFixed(2)}`,
        );
      });
      doc.moveDown(0.3);
    });
    doc.fontSize(11).text(
      `TOTAL In ${Number(payload.total.inflow).toFixed(2)} | Out ${Number(payload.total.outflow).toFixed(2)} | Net ${Number(payload.total.net).toFixed(2)}`,
    );
  });
}

export async function accountCardXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  account: { code: string; name: string };
  opening: { debit: string; credit: string };
  closing: { debit: string; credit: string };
  lines: Array<{
    date: string;
    reference: string | null;
    description: string | null;
    counterpartyName: string | null;
    debit: string;
    credit: string;
    balanceDebit: string;
    balanceCredit: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("AccountCard");
  ws.addRow(["Account", payload.account.code, payload.account.name]);
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([
    "Opening Dr",
    Number(payload.opening.debit),
    "Opening Cr",
    Number(payload.opening.credit),
  ]);
  ws.addRow([]);
  ws.addRow([
    "Date",
    "Reference",
    "Description",
    "Counterparty",
    "Debit",
    "Credit",
    "Balance Dr",
    "Balance Cr",
  ]);
  payload.lines.forEach((l) =>
    ws.addRow([
      l.date,
      l.reference ?? "",
      l.description ?? "",
      l.counterpartyName ?? "",
      Number(l.debit),
      Number(l.credit),
      Number(l.balanceDebit),
      Number(l.balanceCredit),
    ]),
  );
  ws.addRow([]);
  ws.addRow([
    "Closing Dr",
    Number(payload.closing.debit),
    "Closing Cr",
    Number(payload.closing.credit),
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function accountCardPdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  account: { code: string; name: string };
  lines: Array<{
    date: string;
    reference: string | null;
    debit: string;
    credit: string;
  }>;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text(`Account card: ${payload.account.code}`);
    doc.moveDown(0.3).fontSize(10).text(payload.account.name);
    doc.moveDown(0.3).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.lines.forEach((l) => {
      doc.text(
        `${l.date} | ${l.reference ?? "—"} | Dr ${Number(l.debit).toFixed(2)} | Cr ${Number(l.credit).toFixed(2)}`,
      );
    });
  });
}

export async function accountTurnoversXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  rows: Array<{
    accountCode: string;
    accountName: string;
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
  }>;
}): Promise<Buffer> {
  return trialBalanceXlsxBuffer(payload);
}

export async function accountTurnoversPdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  rows: Array<{
    accountCode: string;
    accountName: string;
    periodDebit: string;
    periodCredit: string;
  }>;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text("Account turnovers");
    doc.moveDown(0.5).fontSize(10).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.rows.forEach((r) => {
      doc.text(
        `${r.accountCode} | ${r.accountName} | Dr ${Number(r.periodDebit).toFixed(2)} | Cr ${Number(r.periodCredit).toFixed(2)}`,
      );
    });
  });
}

export async function chessboardXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  accountCodes: string[];
  cells: Array<{
    debitAccountCode: string;
    creditAccountCode: string;
    amount: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Chessboard");
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([]);
  ws.addRow(["Debit account", "Credit account", "Amount"]);
  payload.cells.forEach((c) =>
    ws.addRow([c.debitAccountCode, c.creditAccountCode, Number(c.amount)]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function chessboardPdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  cells: Array<{
    debitAccountCode: string;
    creditAccountCode: string;
    amount: string;
  }>;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text("Chessboard (шахматка)");
    doc.moveDown(0.5).fontSize(10).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.cells.forEach((c) => {
      doc.text(
        `Dr ${c.debitAccountCode} × Cr ${c.creditAccountCode}: ${Number(c.amount).toFixed(2)}`,
      );
    });
  });
}

export async function generalLedgerXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  lines: Array<{
    date: string;
    reference: string | null;
    accountCode: string;
    accountName: string;
    description: string | null;
    counterpartyName: string | null;
    debit: string;
    credit: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("GeneralLedger");
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([]);
  ws.addRow([
    "Date",
    "Reference",
    "Account",
    "Name",
    "Description",
    "Counterparty",
    "Debit",
    "Credit",
  ]);
  payload.lines.forEach((l) =>
    ws.addRow([
      l.date,
      l.reference ?? "",
      l.accountCode,
      l.accountName,
      l.description ?? "",
      l.counterpartyName ?? "",
      Number(l.debit),
      Number(l.credit),
    ]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function generalLedgerPdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  lines: Array<{
    date: string;
    accountCode: string;
    debit: string;
    credit: string;
    reference: string | null;
  }>;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text("General ledger / Journal");
    doc.moveDown(0.5).fontSize(10).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.lines.forEach((l) => {
      doc.text(
        `${l.date} | ${l.accountCode} | ${l.reference ?? "—"} | Dr ${Number(l.debit).toFixed(2)} | Cr ${Number(l.credit).toFixed(2)}`,
      );
    });
  });
}

export async function accountAnalysisXlsxBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  account: { code: string; name: string };
  dimension: string;
  rows: Array<{
    dimensionName: string;
    periodDebit: string;
    periodCredit: string;
    netDebit: string;
    netCredit: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("AccountAnalysis");
  ws.addRow(["Account", payload.account.code, payload.account.name]);
  ws.addRow(["Dimension", payload.dimension]);
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([]);
  ws.addRow(["Dimension", "Period Dr", "Period Cr", "Net Dr", "Net Cr"]);
  payload.rows.forEach((r) =>
    ws.addRow([
      r.dimensionName,
      Number(r.periodDebit),
      Number(r.periodCredit),
      Number(r.netDebit),
      Number(r.netCredit),
    ]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function accountAnalysisPdfBuffer(payload: {
  dateFrom: string;
  dateTo: string;
  account: { code: string; name: string };
  dimension: string;
  rows: Array<{
    dimensionName: string;
    periodDebit: string;
    periodCredit: string;
  }>;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text(`Account analysis: ${payload.account.code}`);
    doc.moveDown(0.3).fontSize(10).text(`${payload.account.name} by ${payload.dimension}`);
    doc.moveDown(0.3).text(`Period: ${payload.dateFrom} - ${payload.dateTo}`);
    doc.moveDown(0.8).fontSize(9);
    payload.rows.forEach((r) => {
      doc.text(
        `${r.dimensionName} | Dr ${Number(r.periodDebit).toFixed(2)} | Cr ${Number(r.periodCredit).toFixed(2)}`,
      );
    });
  });
}

const MHBS_FORM_TITLES: Record<string, string> = {
  BALANCE: "MHBS — Balance Sheet",
  PL: "MHBS — Income Statement",
  CASH_FLOW: "MHBS — Cash Flow",
  EQUITY_CHANGES: "MHBS — Statement of Changes in Equity",
  NOTES: "MHBS — Notes to Financial Statements",
};

export async function mhbsStatementXlsxBuffer(payload: {
  form: string;
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  lines: Array<{
    lineCode: string;
    labelAz: string;
    labelEn: string;
    amount: string;
    opening?: string;
    increase?: string;
    decrease?: string;
    closing?: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(payload.form);
  ws.addRow([MHBS_FORM_TITLES[payload.form] ?? payload.form]);
  if (payload.asOfDate) ws.addRow(["As of", payload.asOfDate]);
  if (payload.dateFrom && payload.dateTo) {
    ws.addRow(["Period", `${payload.dateFrom} — ${payload.dateTo}`]);
  }
  if (payload.year) ws.addRow(["Year", payload.year]);
  ws.addRow([]);
  const hasEquityCols = payload.form === "EQUITY_CHANGES";
  if (hasEquityCols) {
    ws.addRow(["Line", "Label (AZ)", "Label (EN)", "Opening", "Increase", "Decrease", "Closing"]);
    payload.lines.forEach((l) =>
      ws.addRow([
        l.lineCode,
        l.labelAz,
        l.labelEn,
        Number(l.opening ?? 0),
        Number(l.increase ?? 0),
        Number(l.decrease ?? 0),
        Number(l.closing ?? l.amount),
      ]),
    );
  } else {
    ws.addRow(["Line", "Label (AZ)", "Label (EN)", "Amount"]);
    payload.lines.forEach((l) =>
      ws.addRow([l.lineCode, l.labelAz, l.labelEn, Number(l.amount)]),
    );
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function mhbsStatementPdfBuffer(payload: {
  form: string;
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  lines: Array<{
    lineCode: string;
    labelAz: string;
    labelEn: string;
    amount: string;
    opening?: string;
    increase?: string;
    decrease?: string;
    closing?: string;
  }>;
}): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fontSize(16).text(MHBS_FORM_TITLES[payload.form] ?? payload.form);
    if (payload.asOfDate) {
      doc.moveDown(0.3).fontSize(10).text(`As of: ${payload.asOfDate}`);
    }
    if (payload.dateFrom && payload.dateTo) {
      doc.moveDown(0.3).fontSize(10).text(`Period: ${payload.dateFrom} — ${payload.dateTo}`);
    }
    if (payload.year) {
      doc.moveDown(0.3).fontSize(10).text(`Year: ${payload.year}`);
    }
    doc.moveDown(0.8).fontSize(9);
    const hasEquityCols = payload.form === "EQUITY_CHANGES";
    payload.lines.forEach((l) => {
      if (hasEquityCols) {
        doc.text(
          `${l.lineCode} | ${l.labelAz} | open ${Number(l.opening ?? 0).toFixed(2)} + ${Number(l.increase ?? 0).toFixed(2)} − ${Number(l.decrease ?? 0).toFixed(2)} = ${Number(l.closing ?? l.amount).toFixed(2)}`,
        );
      } else {
        doc.text(`${l.lineCode} | ${l.labelAz} | ${Number(l.amount).toFixed(2)}`);
      }
    });
  });
}

export async function statReportXlsxBuffer(payload: {
  definitionCode: string;
  definitionName: string;
  period: string;
  dateFrom: string;
  dateTo: string;
  orgName: string;
  lines: Array<{
    lineCode: string;
    source: string;
    metric?: string;
    amount: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("StatForm");
  ws.addRow(["Organization", payload.orgName]);
  ws.addRow(["Form code", payload.definitionCode]);
  ws.addRow(["Form name", payload.definitionName]);
  ws.addRow(["Period", payload.period]);
  ws.addRow(["Date from", payload.dateFrom, "Date to", payload.dateTo]);
  ws.addRow([]);
  ws.addRow(["Line", "Source", "Metric", "Amount"]);
  payload.lines.forEach((l) =>
    ws.addRow([
      l.lineCode,
      l.source,
      l.metric ?? "",
      Number(l.amount),
    ]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}
