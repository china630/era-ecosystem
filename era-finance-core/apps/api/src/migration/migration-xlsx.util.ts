import type { Workbook, Worksheet } from "exceljs";

export async function loadFirstSheet(buffer: Buffer): Promise<{
  workbook: Workbook;
  sheet: Worksheet;
  header: string[];
}> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("workbook has no sheet");
  const raw = sheet.getRow(1).values as Array<unknown>;
  const headers: string[] = [];
  for (let i = 1; i < (raw?.length ?? 0); i += 1) {
    headers.push(String(raw[i] ?? "").trim());
  }
  return { workbook, sheet, header: headers };
}

export function colIndex(header: string[], name: string): number {
  return header.findIndex((h) => h === name);
}

export function cellText(sheet: Worksheet, rowNumber: number, col: number): string {
  if (col < 0) return "";
  // exceljs cells are 1-indexed
  return String(sheet.getRow(rowNumber).getCell(col + 1).text ?? "").trim();
}

export function cellNumber(sheet: Worksheet, rowNumber: number, col: number): number | null {
  if (col < 0) return null;
  const cell = sheet.getRow(rowNumber).getCell(col + 1);
  const n = Number(cell.text || cell.value);
  return Number.isFinite(n) ? n : null;
}

export async function buildTemplateBuffer(params: {
  sheetName: string;
  columns: Array<{ key: string; sample: string | number | boolean }>;
  howto: string[];
}): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const data = wb.addWorksheet(params.sheetName);
  data.addRow(params.columns.map((c) => c.key));
  data.addRow(params.columns.map((c) => c.sample));
  const howto = wb.addWorksheet("How to fill");
  howto.addRow(["Instruction"]);
  for (const line of params.howto) {
    howto.addRow([line]);
  }
  howto.addRow([]);
  howto.addRow(["Empty rows are skipped."]);
  howto.addRow(["Error export adds columns row and error."]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return buf;
}

export async function buildErrorWorkbook(params: {
  sheetName: string;
  headers: string[];
  rows: Array<{ row: number; values: Record<string, string | number>; error: string }>;
}): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(params.sheetName);
  sheet.addRow([...params.headers, "row", "error"]);
  for (const r of params.rows) {
    sheet.addRow([
      ...params.headers.map((h) => r.values[h] ?? ""),
      r.row,
      r.error,
    ]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
