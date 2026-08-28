import * as XLSX from "xlsx";
import { csvFromWorkforceImportBody } from "./workforce-xlsx";

describe("csvFromWorkforceImportBody", () => {
  it("converts xlsx date serials on hireDate/birthDate columns", () => {
    const aoa = [
      ["fin", "fullName", "hireDate", "birthDate"],
      ["1A2B3C4", "Ali", 46154, 28019],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "import");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const csv = csvFromWorkforceImportBody({ xlsxBase64: buf.toString("base64") });
    const lines = csv.trim().split(/\n/);
    expect(lines[0]).toBe("fin,fullName,hireDate,birthDate");
    expect(lines[1]).toBe("1A2B3C4,Ali,2026-05-12,1976-09-16");
  });
});
