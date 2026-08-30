import * as XLSX from 'xlsx';

export type ParsedWorkbook = {
  sheetName: string;
  rows: Record<string, unknown>[];
};

/** Parse first worksheet of an Elektraweb .xlsx export into row objects keyed by header. */
export function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { sheetName: '', rows: [] };
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });
  return { sheetName, rows: rows.filter((r) => Object.values(r).some((v) => v != null && String(v).trim() !== '')) };
}
