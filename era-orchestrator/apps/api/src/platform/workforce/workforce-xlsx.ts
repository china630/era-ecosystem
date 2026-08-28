import * as XLSX from "xlsx";
import { BadRequestException } from "@nestjs/common";
import type { ImportCsvDto } from "./dto/workforce-import.dto";
import { normalizeDateOnly } from "./workforce-date";

export { normalizeDateOnly } from "./workforce-date";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const DATE_HEADER_KEYS = new Set([
  "hiredate",
  "birthdate",
  "startdate",
  "enddate",
]);

function headerKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

export function csvFromWorkforceImportBody(body: ImportCsvDto): string {
  if (body.xlsxBase64?.trim()) {
    const buf = Buffer.from(body.xlsxBase64, "base64");
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new BadRequestException("Empty workbook");
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];
    if (!rows.length) throw new BadRequestException("Empty workbook");
    const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());
    const dateIdx = headers
      .map((h, i) => (DATE_HEADER_KEYS.has(headerKey(h)) ? i : -1))
      .filter((i) => i >= 0);
    return rows
      .map((row, rIdx) =>
        headers
          .map((_, c) => {
            let v = row[c];
            if (rIdx > 0 && dateIdx.includes(c)) {
              const n = normalizeDateOnly(v);
              if (n) v = n;
            }
            return csvEscape(v == null ? "" : String(v).trim());
          })
          .join(","),
      )
      .join("\n");
  }
  if (body.csv?.trim()) return body.csv;
  throw new BadRequestException("Provide csv or xlsxBase64");
}
