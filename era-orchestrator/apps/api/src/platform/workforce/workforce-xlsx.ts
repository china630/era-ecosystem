import * as XLSX from "xlsx";
import { BadRequestException } from "@nestjs/common";
import type { ImportCsvDto } from "./dto/workforce-import.dto";

export function csvFromWorkforceImportBody(body: ImportCsvDto): string {
  if (body.xlsxBase64?.trim()) {
    const buf = Buffer.from(body.xlsxBase64, "base64");
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new BadRequestException("Empty workbook");
    return XLSX.utils.sheet_to_csv(sheet);
  }
  if (body.csv?.trim()) return body.csv;
  throw new BadRequestException("Provide csv or xlsxBase64");
}
